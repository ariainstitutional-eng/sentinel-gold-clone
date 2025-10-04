import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  status: z.enum(['pending', 'filled', 'rejected', 'canceled']).optional().default('pending'),
  accountId: z.string().transform(val => parseInt(val)).optional(),
  symbol: z.string().optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)).optional().default('20'),
  offset: z.string().transform(val => parseInt(val) || 0).optional().default('0'),
  search: z.string().optional(),
  sort: z.string().optional().default('placedAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc')
});

export async function GET(request: NextRequest) {
  try {
    // Log bearer token if present (optional debugging)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      console.log('Bearer token present:', authHeader.substring(0, 20) + '...');
    }

    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const validationResult = querySchema.safeParse({
      status: searchParams.get('status'),
      accountId: searchParams.get('accountId'),
      symbol: searchParams.get('symbol'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      search: searchParams.get('search'),
      sort: searchParams.get('sort'),
      order: searchParams.get('order')
    });

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters',
        code: 'INVALID_QUERY_PARAMS',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { status, accountId, symbol, limit, offset, search, sort, order } = validationResult.data;

    // Build query with filters
    let query = db.select().from(orders);
    const conditions = [];

    // Status filter (default to 'pending')
    conditions.push(eq(orders.status, status));

    // Account filter
    if (accountId) {
      conditions.push(eq(orders.accountId, accountId));
    }

    // Symbol filter
    if (symbol) {
      conditions.push(eq(orders.symbol, symbol));
    }

    // Search across relevant text fields
    if (search) {
      const searchConditions = or(
        like(orders.symbol, `%${search}%`),
        like(orders.side, `%${search}%`),
        like(orders.type, `%${search}%`),
        like(orders.status, `%${search}%`),
        like(orders.mt5OrderId, `%${search}%`)
      );
      conditions.push(searchConditions);
    }

    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sorting - default to placedAt DESC (newest first)
    const sortColumn = sort === 'placedAt' ? orders.placedAt : 
                      sort === 'volume' ? orders.volume :
                      sort === 'price' ? orders.price :
                      sort === 'symbol' ? orders.symbol :
                      sort === 'status' ? orders.status :
                      orders.placedAt;

    query = order === 'desc' ? query.orderBy(desc(sortColumn)) : query.orderBy(asc(sortColumn));

    // Apply pagination
    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('GET orders error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { accountId, symbol, side, volume, type, price, sl, tp, mt5OrderId, fusedSignalId } = requestBody;

    // Validate required fields
    if (!accountId) {
      return NextResponse.json({ 
        error: "Account ID is required",
        code: "MISSING_ACCOUNT_ID" 
      }, { status: 400 });
    }

    if (!side || !['buy', 'sell'].includes(side)) {
      return NextResponse.json({ 
        error: "Valid side is required (buy or sell)",
        code: "INVALID_SIDE" 
      }, { status: 400 });
    }

    if (!volume || volume <= 0) {
      return NextResponse.json({ 
        error: "Valid volume is required",
        code: "INVALID_VOLUME" 
      }, { status: 400 });
    }

    if (!type || !['market', 'limit', 'stop'].includes(type)) {
      return NextResponse.json({ 
        error: "Valid type is required (market, limit, or stop)",
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }

    // Validate limit/stop orders have price
    if ((type === 'limit' || type === 'stop') && (!price || price <= 0)) {
      return NextResponse.json({ 
        error: "Price is required for limit and stop orders",
        code: "MISSING_PRICE" 
      }, { status: 400 });
    }

    // Validate account ID is integer
    const parsedAccountId = parseInt(accountId.toString());
    if (isNaN(parsedAccountId)) {
      return NextResponse.json({ 
        error: "Valid account ID is required",
        code: "INVALID_ACCOUNT_ID" 
      }, { status: 400 });
    }

    // Prepare insert data with defaults and system fields
    const insertData = {
      accountId: parsedAccountId,
      symbol: symbol?.trim() || 'XAUUSD',
      side: side.trim(),
      volume: parseFloat(volume),
      type: type.trim(),
      price: price ? parseFloat(price) : null,
      sl: sl ? parseFloat(sl) : null,
      tp: tp ? parseFloat(tp) : null,
      placedAt: Math.floor(Date.now() / 1000), // Unix timestamp
      status: 'pending',
      mt5OrderId: mt5OrderId?.trim() || null,
      fusedSignalId: fusedSignalId ? parseInt(fusedSignalId.toString()) : null
    };

    // Validate fusedSignalId if provided
    if (insertData.fusedSignalId && isNaN(insertData.fusedSignalId)) {
      return NextResponse.json({ 
        error: "Valid fused signal ID is required",
        code: "INVALID_FUSED_SIGNAL_ID" 
      }, { status: 400 });
    }

    const newOrder = await db.insert(orders)
      .values(insertData)
      .returning();

    return NextResponse.json(newOrder[0], { status: 201 });

  } catch (error) {
    console.error('POST orders error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const requestBody = await request.json();
    const { accountId, symbol, side, volume, type, price, sl, tp, status, mt5OrderId, fusedSignalId } = requestBody;

    // Check if order exists
    const existingOrder = await db.select()
      .from(orders)
      .where(eq(orders.id, parseInt(id)))
      .limit(1);

    if (existingOrder.length === 0) {
      return NextResponse.json({ 
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND' 
      }, { status: 404 });
    }

    // Prepare update data
    const updates: any = {};

    if (accountId !== undefined) {
      const parsedAccountId = parseInt(accountId.toString());
      if (isNaN(parsedAccountId)) {
        return NextResponse.json({ 
          error: "Valid account ID is required",
          code: "INVALID_ACCOUNT_ID" 
        }, { status: 400 });
      }
      updates.accountId = parsedAccountId;
    }

    if (symbol !== undefined) {
      updates.symbol = symbol.trim() || 'XAUUSD';
    }

    if (side !== undefined) {
      if (!['buy', 'sell'].includes(side)) {
        return NextResponse.json({ 
          error: "Valid side is required (buy or sell)",
          code: "INVALID_SIDE" 
        }, { status: 400 });
      }
      updates.side = side.trim();
    }

    if (volume !== undefined) {
      if (!volume || volume <= 0) {
        return NextResponse.json({ 
          error: "Valid volume is required",
          code: "INVALID_VOLUME" 
        }, { status: 400 });
      }
      updates.volume = parseFloat(volume);
    }

    if (type !== undefined) {
      if (!['market', 'limit', 'stop'].includes(type)) {
        return NextResponse.json({ 
          error: "Valid type is required (market, limit, or stop)",
          code: "INVALID_TYPE" 
        }, { status: 400 });
      }
      updates.type = type.trim();
    }

    if (price !== undefined) {
      updates.price = price ? parseFloat(price) : null;
    }

    if (sl !== undefined) {
      updates.sl = sl ? parseFloat(sl) : null;
    }

    if (tp !== undefined) {
      updates.tp = tp ? parseFloat(tp) : null;
    }

    if (status !== undefined) {
      if (!['pending', 'filled', 'rejected', 'canceled'].includes(status)) {
        return NextResponse.json({ 
          error: "Valid status is required (pending, filled, rejected, or canceled)",
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
      updates.status = status.trim();
    }

    if (mt5OrderId !== undefined) {
      updates.mt5OrderId = mt5OrderId?.trim() || null;
    }

    if (fusedSignalId !== undefined) {
      if (fusedSignalId && isNaN(parseInt(fusedSignalId.toString()))) {
        return NextResponse.json({ 
          error: "Valid fused signal ID is required",
          code: "INVALID_FUSED_SIGNAL_ID" 
        }, { status: 400 });
      }
      updates.fusedSignalId = fusedSignalId ? parseInt(fusedSignalId.toString()) : null;
    }

    // Validate limit/stop orders have price
    const finalType = updates.type || existingOrder[0].type;
    const finalPrice = updates.price !== undefined ? updates.price : existingOrder[0].price;
    
    if ((finalType === 'limit' || finalType === 'stop') && (!finalPrice || finalPrice <= 0)) {
      return NextResponse.json({ 
        error: "Price is required for limit and stop orders",
        code: "MISSING_PRICE" 
      }, { status: 400 });
    }

    const updated = await db.update(orders)
      .set(updates)
      .where(eq(orders.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });

  } catch (error) {
    console.error('PUT orders error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if order exists
    const existingOrder = await db.select()
      .from(orders)
      .where(eq(orders.id, parseInt(id)))
      .limit(1);

    if (existingOrder.length === 0) {
      return NextResponse.json({ 
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND' 
      }, { status: 404 });
    }

    const deleted = await db.delete(orders)
      .where(eq(orders.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Order deleted successfully',
      deletedOrder: deleted[0]
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE orders error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}