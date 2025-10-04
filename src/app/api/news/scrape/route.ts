import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsItems, auditLogs } from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    // Create initial audit log
    const startTime = Date.now();
    await db.insert(auditLogs).values({
      timestamp: Math.floor(startTime / 1000),
      category: 'system',
      action: 'news_scrape_started',
      details: 'Started Forex Factory news scraping process',
      level: 'info'
    });

    // Fetch Forex Factory calendar page with proper headers
    const forexFactoryUrl = 'https://www.forexfactory.com/calendar';
    const response = await fetch(forexFactoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    if (!html || html.length < 1000) {
      throw new Error('Invalid or empty HTML response from Forex Factory');
    }

    // Parse HTML and extract news events
    const newsEvents = parseForexFactoryHTML(html);

    if (newsEvents.length === 0) {
      await db.insert(auditLogs).values({
        timestamp: Math.floor(Date.now() / 1000),
        category: 'system',
        action: 'news_scrape_no_items',
        details: 'No news items found during scraping',
        level: 'warn'
      });

      return NextResponse.json({
        success: true,
        itemsScraped: 0,
        message: 'No news items found to scrape'
      }, { status: 200 });
    }

    // Store parsed items in database
    let storedCount = 0;
    const errors: string[] = [];

    for (const newsEvent of newsEvents) {
      try {
        await db.insert(newsItems).values({
          publishedAt: newsEvent.publishedAt,
          source: 'forexfactory',
          title: newsEvent.title,
          url: newsEvent.url,
          priority: newsEvent.priority,
          sentiment: newsEvent.sentiment,
          summary: newsEvent.summary
        });
        storedCount++;
      } catch (error) {
        const errorMsg = `Failed to store news item: ${newsEvent.title} - ${error}`;
        errors.push(errorMsg);
        
        await db.insert(auditLogs).values({
          timestamp: Math.floor(Date.now() / 1000),
          category: 'system',
          action: 'news_store_error',
          details: errorMsg,
          level: 'error'
        });
      }
    }

    // Create completion audit log
    const endTime = Date.now();
    const duration = endTime - startTime;

    await db.insert(auditLogs).values({
      timestamp: Math.floor(endTime / 1000),
      category: 'system',
      action: 'news_scrape_completed',
      details: `Scraping completed. Found: ${newsEvents.length}, Stored: ${storedCount}, Duration: ${duration}ms`,
      level: 'info'
    });

    return NextResponse.json({
      success: true,
      itemsScraped: newsEvents.length,
      itemsStored: storedCount,
      duration: `${duration}ms`,
      errors: errors.length > 0 ? errors : undefined
    }, { status: 201 });

  } catch (error) {
    console.error('News scraping error:', error);
    
    // Log the error
    await db.insert(auditLogs).values({
      timestamp: Math.floor(Date.now() / 1000),
      category: 'system',
      action: 'news_scrape_failed',
      details: `Scraping failed: ${error}`,
      level: 'error'
    }).catch(() => {}); // Prevent secondary errors

    return NextResponse.json({
      error: 'Failed to scrape news from Forex Factory',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

interface NewsEvent {
  publishedAt: number;
  title: string;
  url: string | null;
  priority: string;
  sentiment: string;
  summary: string | null;
}

function parseForexFactoryHTML(html: string): NewsEvent[] {
  const newsEvents: NewsEvent[] = [];
  
  try {
    // Basic HTML parsing for Forex Factory calendar structure
    // This is a simplified parser - in production, consider using a proper HTML parser like cheerio
    
    // Extract calendar rows (simplified regex approach)
    const calendarRowRegex = /<tr[^>]*class="[^"]*calendar_row[^"]*"[^>]*>(.*?)<\/tr>/gs;
    const rows = html.match(calendarRowRegex) || [];

    for (const row of rows) {
      try {
        // Extract impact level from bullet classes
        const impactMatch = row.match(/class="[^"]*bullet[^"]*(?:red|orange|yellow|gray)[^"]*"/);
        let priority = 'low';
        
        if (impactMatch) {
          const impactClass = impactMatch[0];
          if (impactClass.includes('red')) {
            priority = 'high';
          } else if (impactClass.includes('orange')) {
            priority = 'medium';
          } else if (impactClass.includes('yellow')) {
            priority = 'low';
          }
        }

        // Extract event title
        const titleMatch = row.match(/<span[^>]*class="[^"]*calendar__event-title[^"]*"[^>]*>([^<]+)</);
        if (!titleMatch) continue;
        
        const title = titleMatch[1].trim();
        if (!title || title.length < 3) continue;

        // Extract time and convert to timestamp
        const timeMatch = row.match(/<td[^>]*class="[^"]*time[^"]*"[^>]*>([^<]+)</);
        let publishedAt = Math.floor(Date.now() / 1000); // Default to current time
        
        if (timeMatch) {
          const timeStr = timeMatch[1].trim();
          // Parse time format (e.g., "2:30pm", "All Day")
          if (timeStr !== 'All Day' && timeStr.match(/\d+:\d+[ap]m/i)) {
            const today = new Date();
            const [time, period] = timeStr.split(/([ap]m)/i);
            const [hours, minutes] = time.split(':');
            let hour = parseInt(hours);
            
            if (period.toLowerCase() === 'pm' && hour !== 12) hour += 12;
            if (period.toLowerCase() === 'am' && hour === 12) hour = 0;
            
            today.setHours(hour, parseInt(minutes), 0, 0);
            publishedAt = Math.floor(today.getTime() / 1000);
          }
        }

        // Apply sentiment analysis
        const sentiment = analyzeSentiment(title);

        // Try to extract URL if available
        const urlMatch = row.match(/<a[^>]*href="([^"]+)"[^>]*>/);
        const url = urlMatch ? `https://www.forexfactory.com${urlMatch[1]}` : null;

        // Extract currency or additional context
        const currencyMatch = row.match(/<td[^>]*class="[^"]*currency[^"]*"[^>]*>([^<]+)</);
        const currency = currencyMatch ? currencyMatch[1].trim() : '';

        const summary = currency ? `Currency: ${currency}` : null;

        newsEvents.push({
          publishedAt,
          title,
          url,
          priority,
          sentiment,
          summary
        });

      } catch (parseError) {
        console.error('Error parsing individual news row:', parseError);
        continue; // Skip this row and continue with others
      }
    }

    // If no events found with the primary method, try alternative parsing
    if (newsEvents.length === 0) {
      // Fallback parsing method
      const eventTitleRegex = /calendar__event-title[^>]*>([^<]+)/g;
      const titles = [];
      let match;
      
      while ((match = eventTitleRegex.exec(html)) !== null) {
        titles.push(match[1].trim());
      }

      for (const title of titles.slice(0, 10)) { // Limit to prevent spam
        if (title.length > 3) {
          newsEvents.push({
            publishedAt: Math.floor(Date.now() / 1000),
            title,
            url: null,
            priority: 'medium',
            sentiment: analyzeSentiment(title),
            summary: null
          });
        }
      }
    }

  } catch (error) {
    console.error('HTML parsing error:', error);
    throw new Error(`Failed to parse Forex Factory HTML: ${error}`);
  }

  // Remove duplicates based on title
  const uniqueEvents = newsEvents.filter((event, index, self) => 
    index === self.findIndex(e => e.title === event.title)
  );

  return uniqueEvents.slice(0, 50); // Limit to prevent database overflow
}

function analyzeSentiment(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Bullish keywords
  const bullishKeywords = [
    'hawkish', 'bullish', 'risk-on', 'positive', 'growth', 'increase', 'rise', 
    'strong', 'robust', 'expansion', 'improvement', 'optimistic', 'surge',
    'rally', 'gains', 'upbeat', 'boost', 'recovery', 'strengthen'
  ];
  
  // Bearish keywords  
  const bearishKeywords = [
    'dovish', 'bearish', 'risk-off', 'negative', 'recession', 'decline', 'fall',
    'weak', 'slowdown', 'contraction', 'deterioration', 'pessimistic', 'plunge',
    'selloff', 'losses', 'concern', 'weakness', 'crisis', 'worries'
  ];

  let bullishScore = 0;
  let bearishScore = 0;

  // Count keyword matches
  for (const keyword of bullishKeywords) {
    if (lowerText.includes(keyword)) {
      bullishScore++;
    }
  }

  for (const keyword of bearishKeywords) {
    if (lowerText.includes(keyword)) {
      bearishScore++;
    }
  }

  // Determine sentiment based on scores
  if (bullishScore > bearishScore) {
    return 'bullish';
  } else if (bearishScore > bullishScore) {
    return 'bearish';
  } else {
    return 'neutral';
  }
}