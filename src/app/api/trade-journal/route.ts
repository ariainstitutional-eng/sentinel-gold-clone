import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tradeJournal, positions } from '@/db/schema';
import { eq, like, and, or, desc, asc, gte, lte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single record by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const record = await db.select()
        .from(tradeJournal)
        .where(eq(tradeJournal.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ 
          error: 'Trade journal entry not found' 
        }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    // List with pagination and filtering
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const symbol = searchParams.get('symbol');
    const side = searchParams.get('side');
    const sentiment = searchParams.get('sentiment');
    const strategy = searchParams.get('strategy');
    const positionId = searchParams.get('positionId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const sort = searchParams.get('sort') || 'openedAt';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(tradeJournal);
    let conditions = [];

    // Search across notes and strategy fields
    if (search) {
      conditions.push(or(
        like(tradeJournal.notes, `%${search}%`),
        like(tradeJournal.strategy, `%${search}%`)
      ));
    }

    // Symbol filter
    if (symbol) {
      conditions.push(eq(tradeJournal.symbol, symbol));
    }

    // Side filter
    if (side && (side === 'buy' || side === 'sell')) {
      conditions.push(eq(tradeJournal.side, side));
    }

    // Sentiment filter
    if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) {
      conditions.push(eq(tradeJournal.sentiment, sentiment));
    }

    // Strategy filter
    if (strategy) {
      conditions.push(eq(tradeJournal.strategy, strategy));
    }

    // Position ID filter
    if (positionId && !isNaN(parseInt(positionId))) {
      conditions.push(eq(tradeJournal.positionId, parseInt(positionId)));
    }

    // Date range filters
    if (fromDate && !isNaN(parseInt(fromDate))) {
      conditions.push(gte(tradeJournal.openedAt, parseInt(fromDate)));
    }

    if (toDate && !isNaN(parseInt(toDate))) {
      conditions.push(lte(tradeJournal.openedAt, parseInt(toDate)));
    }

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sorting
    const sortColumn = sort === 'openedAt' ? tradeJournal.openedAt :
                      sort === 'closedAt' ? tradeJournal.closedAt :
                      sort === 'pnl' ? tradeJournal.pnl :
                      sort === 'entryPrice' ? tradeJournal.entryPrice :
                      sort === 'exitPrice' ? tradeJournal.exitPrice :
                      sort === 'volume' ? tradeJournal.volume :
                      sort === 'duration' ? tradeJournal.duration :
                      tradeJournal.openedAt;

    if (order === 'asc') {
      query = query.orderBy(asc(sortColumn));
    } else {
      query = query.orderBy(desc(sortColumn));
    }

    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      positionId, 
      symbol = 'XAUUSD', 
      side, 
      entryPrice, 
      exitPrice, 
      volume, 
      strategy, 
      notes, 
      sentiment = 'neutral', 
      openedAt, 
      closedAt 
    } = body;

    // Validation
    if (!side || !['buy', 'sell'].includes(side)) {
      return NextResponse.json({ 
        error: "Side must be 'buy' or 'sell'",
        code: "INVALID_SIDE" 
      }, { status: 400 });
    }

    if (!entryPrice || entryPrice <= 0) {
      return NextResponse.json({ 
        error: "Entry price must be greater than 0",
        code: "INVALID_ENTRY_PRICE" 
      }, { status: 400 });
    }

    if (exitPrice && exitPrice <= 0) {
      return NextResponse.json({ 
        error: "Exit price must be greater than 0",
        code: "INVALID_EXIT_PRICE" 
      }, { status: 400 });
    }

    if (!volume || volume <= 0) {
      return NextResponse.json({ 
        error: "Volume must be greater than 0",
        code: "INVALID_VOLUME" 
      }, { status: 400 });
    }

    if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
      return NextResponse.json({ 
        error: "Sentiment must be 'positive', 'negative', or 'neutral'",
        code: "INVALID_SENTIMENT" 
      }, { status: 400 });
    }

    if (!openedAt) {
      return NextResponse.json({ 
        error: "Opened at timestamp is required",
        code: "MISSING_OPENED_AT" 
      }, { status: 400 });
    }

    if (closedAt && closedAt <= openedAt) {
      return NextResponse.json({ 
        error: "Closed at timestamp must be after opened at timestamp",
        code: "INVALID_CLOSED_AT" 
      }, { status: 400 });
    }

    // Validate positionId exists if provided
    if (positionId) {
      const position = await db.select()
        .from(positions)
        .where(eq(positions.id, positionId))
        .limit(1);

      if (position.length === 0) {
        return NextResponse.json({ 
          error: "Position not found",
          code: "POSITION_NOT_FOUND" 
        }, { status: 404 });
      }
    }

    // Auto-calculate PnL if entry and exit prices provided
    let calculatedPnl = null;
    if (entryPrice && exitPrice) {
      const multiplier = side === 'buy' ? 1 : -1;
      calculatedPnl = (exitPrice - entryPrice) * volume * multiplier;
    }

    // Auto-calculate duration if both timestamps provided
    let calculatedDuration = null;
    if (openedAt && closedAt) {
      calculatedDuration = closedAt - openedAt;
    }

    const insertData = {
      positionId: positionId || null,
      symbol: symbol.trim(),
      side,
      entryPrice,
      exitPrice: exitPrice || null,
      volume,
      pnl: calculatedPnl,
      duration: calculatedDuration,
      strategy: strategy?.trim() || null,
      notes: notes?.trim() || null,
      sentiment,
      openedAt,
      closedAt: closedAt || null
    };

    const newRecord = await db.insert(tradeJournal)
      .values(insertData)
      .returning();

    return NextResponse.json(newRecord[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const updates: any = {};

    // Check if record exists
    const existingRecord = await db.select()
      .from(tradeJournal)
      .where(eq(tradeJournal.id, parseInt(id)))
      .limit(1);

    if (existingRecord.length === 0) {
      return NextResponse.json({ 
        error: 'Trade journal entry not found' 
      }, { status: 404 });
    }

    const current = existingRecord[0];

    // Validate and prepare updates
    if (body.side !== undefined) {
      if (!['buy', 'sell'].includes(body.side)) {
        return NextResponse.json({ 
          error: "Side must be 'buy' or 'sell'",
          code: "INVALID_SIDE" 
        }, { status: 400 });
      }
      updates.side = body.side;
    }

    if (body.entryPrice !== undefined) {
      if (body.entryPrice <= 0) {
        return NextResponse.json({ 
          error: "Entry price must be greater than 0",
          code: "INVALID_ENTRY_PRICE" 
        }, { status: 400 });
      }
      updates.entryPrice = body.entryPrice;
    }

    if (body.exitPrice !== undefined) {
      if (body.exitPrice !== null && body.exitPrice <= 0) {
        return NextResponse.json({ 
          error: "Exit price must be greater than 0",
          code: "INVALID_EXIT_PRICE" 
        }, { status: 400 });
      }
      updates.exitPrice = body.exitPrice;
    }

    if (body.volume !== undefined) {
      if (body.volume <= 0) {
        return NextResponse.json({ 
          error: "Volume must be greater than 0",
          code: "INVALID_VOLUME" 
        }, { status: 400 });
      }
      updates.volume = body.volume;
    }

    if (body.sentiment !== undefined) {
      if (!['positive', 'negative', 'neutral'].includes(body.sentiment)) {
        return NextResponse.json({ 
          error: "Sentiment must be 'positive', 'negative', or 'neutral'",
          code: "INVALID_SENTIMENT" 
        }, { status: 400 });
      }
      updates.sentiment = body.sentiment;
    }

    if (body.openedAt !== undefined) {
      updates.openedAt = body.openedAt;
    }

    if (body.closedAt !== undefined) {
      const openedAt = updates.openedAt || current.openedAt;
      if (body.closedAt !== null && body.closedAt <= openedAt) {
        return NextResponse.json({ 
          error: "Closed at timestamp must be after opened at timestamp",
          code: "INVALID_CLOSED_AT" 
        }, { status: 400 });
      }
      updates.closedAt = body.closedAt;
    }

    if (body.positionId !== undefined) {
      if (body.positionId !== null) {
        const position = await db.select()
          .from(positions)
          .where(eq(positions.id, body.positionId))
          .limit(1);

        if (position.length === 0) {
          return NextResponse.json({ 
            error: "Position not found",
            code: "POSITION_NOT_FOUND" 
          }, { status: 404 });
        }
      }
      updates.positionId = body.positionId;
    }

    if (body.symbol !== undefined) {
      updates.symbol = body.symbol.trim();
    }

    if (body.strategy !== undefined) {
      updates.strategy = body.strategy?.trim() || null;
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes?.trim() || null;
    }

    // Recalculate PnL if relevant fields updated
    const finalEntryPrice = updates.entryPrice !== undefined ? updates.entryPrice : current.entryPrice;
    const finalExitPrice = updates.exitPrice !== undefined ? updates.exitPrice : current.exitPrice;
    const finalVolume = updates.volume !== undefined ? updates.volume : current.volume;
    const finalSide = updates.side !== undefined ? updates.side : current.side;

    if (finalEntryPrice && finalExitPrice && finalVolume && finalSide) {
      const multiplier = finalSide === 'buy' ? 1 : -1;
      updates.pnl = (finalExitPrice - finalEntryPrice) * finalVolume * multiplier;
    }

    // Recalculate duration if relevant fields updated
    const finalOpenedAt = updates.openedAt !== undefined ? updates.openedAt : current.openedAt;
    const finalClosedAt = updates.closedAt !== undefined ? updates.closedAt : current.closedAt;

    if (finalOpenedAt && finalClosedAt) {
      updates.duration = finalClosedAt - finalOpenedAt;
    }

    const updated = await db.update(tradeJournal)
      .set(updates)
      .where(eq(tradeJournal.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PATCH error:', error);
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

    // Check if record exists
    const existingRecord = await db.select()
      .from(tradeJournal)
      .where(eq(tradeJournal.id, parseInt(id)))
      .limit(1);

    if (existingRecord.length === 0) {
      return NextResponse.json({ 
        error: 'Trade journal entry not found' 
      }, { status: 404 });
    }

    const deleted = await db.delete(tradeJournal)
      .where(eq(tradeJournal.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Trade journal entry deleted successfully',
      deletedRecord: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}