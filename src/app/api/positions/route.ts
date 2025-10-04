import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

// Query parameters validation schema
const querySchema = z.object({
  status: z.enum(['open', 'closed']).default('open'),
  accountId: z.string().transform(val => parseInt(val)).optional(),
  symbol: z.string().optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)).default('20'),
  offset: z.string().transform(val => parseInt(val) || 0).default('0'),
  search: z.string().optional(),
  sort: z.enum(['openedAt', 'closedAt', 'pnl', 'entryPrice']).default('openedAt'),
  order: z.enum(['asc', 'desc']).default('desc')
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Log bearer token if present
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      console.log('Bearer token present:', authHeader.substring(0, 20) + '...');
    }

    // Validate query parameters
    const queryResult = querySchema.safeParse({
      status: searchParams.get('status') || 'open',
      accountId: searchParams.get('accountId') || undefined,
      symbol: searchParams.get('symbol') || undefined,
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
      search: searchParams.get('search') || undefined,
      sort: searchParams.get('sort') || 'openedAt',
      order: searchParams.get('order') || 'desc'
    });

    if (!queryResult.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters',
        code: 'INVALID_QUERY_PARAMS',
        details: queryResult.error.errors
      }, { status: 400 });
    }

    const { status, accountId, symbol, limit, offset, search, sort, order } = queryResult.data;

    // Build query with filters
    let query = db.select().from(positions);
    const conditions = [];

    // Filter by status
    conditions.push(eq(positions.status, status));

    // Filter by accountId if provided
    if (accountId) {
      if (isNaN(accountId)) {
        return NextResponse.json({ 
          error: 'Valid account ID is required',
          code: 'INVALID_ACCOUNT_ID' 
        }, { status: 400 });
      }
      conditions.push(eq(positions.accountId, accountId));
    }

    // Filter by symbol if provided
    if (symbol) {
      conditions.push(eq(positions.symbol, symbol));
    }

    // Search across symbol and side
    if (search) {
      const searchCondition = or(
        like(positions.symbol, `%${search}%`),
        like(positions.side, `%${search}%`)
      );
      conditions.push(searchCondition);
    }

    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const sortField = positions[sort as keyof typeof positions];
    const sortOrder = order === 'desc' ? desc(sortField) : asc(sortField);
    query = query.orderBy(sortOrder);

    // Apply pagination
    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('GET positions error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Log bearer token if present
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      console.log('Bearer token present:', authHeader.substring(0, 20) + '...');
    }

    const requestBody = await request.json();
    const { 
      accountId, 
      symbol = 'XAUUSD', 
      side, 
      volume, 
      entryPrice, 
      sl, 
      tp, 
      openedAt,
      fusedSignalId,
      status = 'open'
    } = requestBody;

    // Validate required fields
    if (!accountId) {
      return NextResponse.json({ 
        error: "Account ID is required",
        code: "MISSING_ACCOUNT_ID" 
      }, { status: 400 });
    }

    if (!side || !['buy', 'sell'].includes(side)) {
      return NextResponse.json({ 
        error: "Side must be 'buy' or 'sell'",
        code: "INVALID_SIDE" 
      }, { status: 400 });
    }

    if (!volume || volume <= 0) {
      return NextResponse.json({ 
        error: "Volume must be greater than 0",
        code: "INVALID_VOLUME" 
      }, { status: 400 });
    }

    if (!entryPrice || entryPrice <= 0) {
      return NextResponse.json({ 
        error: "Entry price must be greater than 0",
        code: "INVALID_ENTRY_PRICE" 
      }, { status: 400 });
    }

    if (!openedAt) {
      return NextResponse.json({ 
        error: "Opened at timestamp is required",
        code: "MISSING_OPENED_AT" 
      }, { status: 400 });
    }

    // Validate account ID and fused signal ID are integers
    if (isNaN(parseInt(accountId))) {
      return NextResponse.json({ 
        error: "Valid account ID is required",
        code: "INVALID_ACCOUNT_ID" 
      }, { status: 400 });
    }

    if (fusedSignalId && isNaN(parseInt(fusedSignalId))) {
      return NextResponse.json({ 
        error: "Valid fused signal ID is required",
        code: "INVALID_FUSED_SIGNAL_ID" 
      }, { status: 400 });
    }

    // Prepare insert data
    const insertData = {
      accountId: parseInt(accountId),
      symbol: symbol.trim(),
      side,
      volume: parseFloat(volume),
      entryPrice: parseFloat(entryPrice),
      sl: sl ? parseFloat(sl) : null,
      tp: tp ? parseFloat(tp) : null,
      openedAt: parseInt(openedAt),
      status,
      fusedSignalId: fusedSignalId ? parseInt(fusedSignalId) : null
    };

    const newPosition = await db.insert(positions)
      .values(insertData)
      .returning();

    return NextResponse.json(newPosition[0], { status: 201 });

  } catch (error) {
    console.error('POST positions error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Log bearer token if present
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      console.log('Bearer token present:', authHeader.substring(0, 20) + '...');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const requestBody = await request.json();
    const updates: any = {};

    // Build update object with only provided fields
    if (requestBody.symbol !== undefined) updates.symbol = requestBody.symbol.trim();
    if (requestBody.side !== undefined) {
      if (!['buy', 'sell'].includes(requestBody.side)) {
        return NextResponse.json({ 
          error: "Side must be 'buy' or 'sell'",
          code: "INVALID_SIDE" 
        }, { status: 400 });
      }
      updates.side = requestBody.side;
    }
    if (requestBody.volume !== undefined) {
      if (requestBody.volume <= 0) {
        return NextResponse.json({ 
          error: "Volume must be greater than 0",
          code: "INVALID_VOLUME" 
        }, { status: 400 });
      }
      updates.volume = parseFloat(requestBody.volume);
    }
    if (requestBody.entryPrice !== undefined) {
      if (requestBody.entryPrice <= 0) {
        return NextResponse.json({ 
          error: "Entry price must be greater than 0",
          code: "INVALID_ENTRY_PRICE" 
        }, { status: 400 });
      }
      updates.entryPrice = parseFloat(requestBody.entryPrice);
    }
    if (requestBody.sl !== undefined) updates.sl = requestBody.sl ? parseFloat(requestBody.sl) : null;
    if (requestBody.tp !== undefined) updates.tp = requestBody.tp ? parseFloat(requestBody.tp) : null;
    if (requestBody.closedAt !== undefined) updates.closedAt = requestBody.closedAt ? parseInt(requestBody.closedAt) : null;
    if (requestBody.pnl !== undefined) updates.pnl = requestBody.pnl ? parseFloat(requestBody.pnl) : null;
    if (requestBody.status !== undefined) {
      if (!['open', 'closed'].includes(requestBody.status)) {
        return NextResponse.json({ 
          error: "Status must be 'open' or 'closed'",
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
      updates.status = requestBody.status;
    }
    if (requestBody.fusedSignalId !== undefined) {
      if (requestBody.fusedSignalId && isNaN(parseInt(requestBody.fusedSignalId))) {
        return NextResponse.json({ 
          error: "Valid fused signal ID is required",
          code: "INVALID_FUSED_SIGNAL_ID" 
        }, { status: 400 });
      }
      updates.fusedSignalId = requestBody.fusedSignalId ? parseInt(requestBody.fusedSignalId) : null;
    }

    // Check if position exists
    const existingPosition = await db.select()
      .from(positions)
      .where(eq(positions.id, parseInt(id)))
      .limit(1);

    if (existingPosition.length === 0) {
      return NextResponse.json({ 
        error: 'Position not found' 
      }, { status: 404 });
    }

    const updated = await db.update(positions)
      .set(updates)
      .where(eq(positions.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });

  } catch (error) {
    console.error('PUT positions error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Log bearer token if present
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      console.log('Bearer token present:', authHeader.substring(0, 20) + '...');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if position exists
    const existingPosition = await db.select()
      .from(positions)
      .where(eq(positions.id, parseInt(id)))
      .limit(1);

    if (existingPosition.length === 0) {
      return NextResponse.json({ 
        error: 'Position not found' 
      }, { status: 404 });
    }

    const deleted = await db.delete(positions)
      .where(eq(positions.id, parseInt(id)))
      .returning();

    return NextResponse.json({ 
      message: 'Position deleted successfully',
      deletedPosition: deleted[0]
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE positions error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}