import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsItems } from '@/db/schema';
import { eq, like, and, or, desc } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.string().nullable().transform(val => {
    const parsed = parseInt(val || '20', 10);
    return isNaN(parsed) ? 20 : Math.min(Math.max(parsed, 1), 100);
  }),
  offset: z.string().nullable().transform(val => {
    const parsed = parseInt(val || '0', 10);
    return isNaN(parsed) ? 0 : Math.max(parsed, 0);
  }),
  source: z.string().nullable(),
  priority: z.enum(['high', 'medium', 'low']).nullable(),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']).nullable(),
  search: z.string().nullable()
});

export async function GET(request: NextRequest) {
  try {
    // Log bearer token if present (optional)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      console.log('News API accessed with bearer token');
    }

    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const validationResult = querySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      source: searchParams.get('source'),
      priority: searchParams.get('priority'),
      sentiment: searchParams.get('sentiment'),
      search: searchParams.get('search')
    });

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: validationResult.error.errors,
        code: 'INVALID_QUERY_PARAMS'
      }, { status: 400 });
    }

    const { limit, offset, source, priority, sentiment, search } = validationResult.data;

    // Build query with filters
    let query = db.select().from(newsItems);
    
    const conditions = [];

    // Filter by source
    if (source) {
      conditions.push(eq(newsItems.source, source));
    }

    // Filter by priority
    if (priority) {
      conditions.push(eq(newsItems.priority, priority));
    }

    // Filter by sentiment
    if (sentiment) {
      conditions.push(eq(newsItems.sentiment, sentiment));
    }

    // Search across title and summary
    if (search) {
      const searchCondition = or(
        like(newsItems.title, `%${search}%`),
        like(newsItems.summary, `%${search}%`)
      );
      conditions.push(searchCondition);
    }

    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Order by publishedAt DESC (newest first) and apply pagination
    const results = await query
      .orderBy(desc(newsItems.publishedAt))
      .limit(limit)
      .offset(offset);

    // Transform publishedAt from Unix timestamp to ISO string for better API response
    const transformedResults = results.map(item => ({
      ...item,
      publishedAt: item.publishedAt
    }));

    return NextResponse.json(transformedResults);

  } catch (error) {
    console.error('GET /api/news error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}