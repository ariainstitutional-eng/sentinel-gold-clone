import { db } from '@/db';
import { newsItems } from '@/db/schema';

async function main() {
    const sampleNews = [
        {
            publishedAt: Math.floor(new Date(Date.now() - 2 * 60 * 60 * 1000).getTime() / 1000), // 2 hours ago
            source: 'bloomberg',
            title: 'Fed Chair Signals Dovish Stance, Markets Rally on Rate Cut Hopes',
            url: 'https://www.bloomberg.com/news/articles/2024/fed-chair-dovish-stance-rate-cuts',
            priority: 'high',
            sentiment: 'bullish',
            summary: 'Federal Reserve Chair Jerome Powell indicated a more accommodative monetary policy stance during congressional testimony, fueling expectations for potential rate cuts in the coming months. Gold prices surged 1.2% as lower interest rates reduce the opportunity cost of holding non-yielding assets.'
        },
        {
            publishedAt: Math.floor(new Date(Date.now() - 4 * 60 * 60 * 1000).getTime() / 1000), // 4 hours ago
            source: 'forexfactory',
            title: 'Geopolitical Tensions Escalate, Gold Surges as Safe Haven Demand Rises',
            url: 'https://www.forexfactory.com/news/geopolitical-tensions-gold-safe-haven-demand',
            priority: 'high',
            sentiment: 'bearish',
            summary: 'Escalating tensions in Eastern Europe and the Middle East have sparked massive safe-haven flows into gold, pushing XAUUSD above key resistance levels. Risk-off sentiment dominates global markets as investors seek refuge in precious metals amid uncertainty.'
        },
        {
            publishedAt: Math.floor(new Date(Date.now() - 6 * 60 * 60 * 1000).getTime() / 1000), // 6 hours ago
            source: 'investing',
            title: 'ECB Monetary Policy Decision Expected Later Today',
            url: 'https://www.investing.com/news/economy/ecb-monetary-policy-decision-preview',
            priority: 'medium',
            sentiment: 'neutral',
            summary: 'The European Central Bank is set to announce its latest monetary policy decision at 1:45 PM GMT. Market consensus expects rates to remain unchanged, though any dovish commentary could impact EUR/USD and indirectly influence gold prices through dollar strength dynamics.'
        },
        {
            publishedAt: Math.floor(new Date(Date.now() - 8 * 60 * 60 * 1000).getTime() / 1000), // 8 hours ago
            source: 'bloomberg',
            title: 'US GDP Growth Exceeds Expectations in Latest Quarter',
            url: 'https://www.bloomberg.com/news/articles/2024/us-gdp-growth-exceeds-expectations',
            priority: 'medium',
            sentiment: 'bullish',
            summary: 'US economic growth accelerated beyond forecasts in Q4, with GDP expanding at an annualized rate of 3.1% versus the expected 2.8%. Strong consumer spending and business investment drove the upside surprise, potentially reducing Fed dovishness and supporting dollar strength against gold.'
        },
        {
            publishedAt: Math.floor(new Date(Date.now() - 12 * 60 * 60 * 1000).getTime() / 1000), // 12 hours ago
            source: 'forexfactory',
            title: 'Consumer Confidence Drops to Six-Month Low',
            url: 'https://www.forexfactory.com/news/consumer-confidence-drops-six-month-low',
            priority: 'low',
            sentiment: 'bearish',
            summary: 'The Consumer Confidence Index fell to 98.7 in January, marking its lowest level since July 2023. Concerns over inflation persistence and labor market softening weighed on household sentiment, potentially supporting gold as an inflation hedge despite mixed economic signals.'
        },
        {
            publishedAt: Math.floor(new Date(Date.now() - 16 * 60 * 60 * 1000).getTime() / 1000), // 16 hours ago
            source: 'investing',
            title: 'Weekly Crude Oil Inventory Report Shows Mixed Results',
            url: 'https://www.investing.com/news/commodities-news/weekly-crude-oil-inventory-mixed-results',
            priority: 'low',
            sentiment: 'neutral',
            summary: 'The EIA weekly petroleum status report revealed a crude oil inventory draw of 2.1M barrels, slightly below the expected 2.4M decline. Gasoline stocks rose unexpectedly while distillate inventories fell. Mixed energy sector signals may have limited impact on broader commodity markets including gold.'
        }
    ];

    await db.insert(newsItems).values(sampleNews);
    
    console.log('✅ News items seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});