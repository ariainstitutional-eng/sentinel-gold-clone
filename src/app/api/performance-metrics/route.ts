import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { performanceMetrics } from '@/db/schema';
import { eq, gte, lte, and, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single record fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const record = await db.select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ error: 'Performance metrics not found' }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    // List with pagination and filtering
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const sort = searchParams.get('sort') || 'date';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(performanceMetrics);

    // Date range filtering
    const conditions = [];
    if (fromDate) {
      const fromTimestamp = parseInt(fromDate);
      if (!isNaN(fromTimestamp)) {
        conditions.push(gte(performanceMetrics.date, fromTimestamp));
      }
    }
    if (toDate) {
      const toTimestamp = parseInt(toDate);
      if (!isNaN(toTimestamp)) {
        conditions.push(lte(performanceMetrics.date, toTimestamp));
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sorting
    const sortField = sort === 'pnl' ? performanceMetrics.totalPnL : 
                     sort === 'winRate' ? performanceMetrics.winRate : 
                     performanceMetrics.date;
    
    const orderBy = order === 'asc' ? asc(sortField) : desc(sortField);
    query = query.orderBy(orderBy);

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
      date, 
      totalTrades = 0, 
      winningTrades = 0, 
      losingTrades = 0, 
      totalPnL = 0.0,
      avgWin = 0.0,
      avgLoss = 0.0,
      sharpeRatio = 0.0,
      maxDrawdown = 0.0,
      equity = 0.0
    } = body;

    // Validation
    if (!date) {
      return NextResponse.json({ 
        error: "Date is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    const dateTimestamp = parseInt(date);
    if (isNaN(dateTimestamp)) {
      return NextResponse.json({ 
        error: "Date must be a valid timestamp",
        code: "INVALID_DATE" 
      }, { status: 400 });
    }

    if (totalTrades < 0) {
      return NextResponse.json({ 
        error: "Total trades must be non-negative",
        code: "INVALID_TOTAL_TRADES" 
      }, { status: 400 });
    }

    if (winningTrades < 0) {
      return NextResponse.json({ 
        error: "Winning trades must be non-negative",
        code: "INVALID_WINNING_TRADES" 
      }, { status: 400 });
    }

    if (losingTrades < 0) {
      return NextResponse.json({ 
        error: "Losing trades must be non-negative",
        code: "INVALID_LOSING_TRADES" 
      }, { status: 400 });
    }

    if (winningTrades > totalTrades) {
      return NextResponse.json({ 
        error: "Winning trades cannot exceed total trades",
        code: "WINNING_TRADES_EXCEED_TOTAL" 
      }, { status: 400 });
    }

    if (losingTrades > totalTrades) {
      return NextResponse.json({ 
        error: "Losing trades cannot exceed total trades",
        code: "LOSING_TRADES_EXCEED_TOTAL" 
      }, { status: 400 });
    }

    if (winningTrades + losingTrades > totalTrades) {
      return NextResponse.json({ 
        error: "Winning trades plus losing trades cannot exceed total trades",
        code: "TRADES_SUM_EXCEED_TOTAL" 
      }, { status: 400 });
    }

    if (equity < 0) {
      return NextResponse.json({ 
        error: "Equity must be non-negative",
        code: "INVALID_EQUITY" 
      }, { status: 400 });
    }

    // Auto-calculate derived fields
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0.0;
    
    let profitFactor = 0.0;
    if (avgLoss !== 0 && winningTrades > 0) {
      const totalWins = winningTrades * avgWin;
      const totalLosses = Math.abs(losingTrades * avgLoss);
      profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0.0;
    }

    const insertData = {
      date: dateTimestamp,
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnL,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      equity,
      createdAt: Date.now()
    };

    const newRecord = await db.insert(performanceMetrics)
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

    // Check if record exists
    const existing = await db.select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Performance metrics not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: any = {};

    // Validate and prepare updates
    if ('date' in body) {
      const dateTimestamp = parseInt(body.date);
      if (isNaN(dateTimestamp)) {
        return NextResponse.json({ 
          error: "Date must be a valid timestamp",
          code: "INVALID_DATE" 
        }, { status: 400 });
      }
      updates.date = dateTimestamp;
    }

    if ('totalTrades' in body) {
      if (body.totalTrades < 0) {
        return NextResponse.json({ 
          error: "Total trades must be non-negative",
          code: "INVALID_TOTAL_TRADES" 
        }, { status: 400 });
      }
      updates.totalTrades = body.totalTrades;
    }

    if ('winningTrades' in body) {
      if (body.winningTrades < 0) {
        return NextResponse.json({ 
          error: "Winning trades must be non-negative",
          code: "INVALID_WINNING_TRADES" 
        }, { status: 400 });
      }
      updates.winningTrades = body.winningTrades;
    }

    if ('losingTrades' in body) {
      if (body.losingTrades < 0) {
        return NextResponse.json({ 
          error: "Losing trades must be non-negative",
          code: "INVALID_LOSING_TRADES" 
        }, { status: 400 });
      }
      updates.losingTrades = body.losingTrades;
    }

    if ('equity' in body) {
      if (body.equity < 0) {
        return NextResponse.json({ 
          error: "Equity must be non-negative",
          code: "INVALID_EQUITY" 
        }, { status: 400 });
      }
      updates.equity = body.equity;
    }

    // Copy other fields if provided
    const allowedFields = ['totalPnL', 'avgWin', 'avgLoss', 'sharpeRatio', 'maxDrawdown'];
    allowedFields.forEach(field => {
      if (field in body) {
        updates[field] = body[field];
      }
    });

    // Get current values for validation and recalculation
    const current = existing[0];
    const finalTotalTrades = updates.totalTrades ?? current.totalTrades;
    const finalWinningTrades = updates.winningTrades ?? current.winningTrades;
    const finalLosingTrades = updates.losingTrades ?? current.losingTrades;

    // Validate trade constraints
    if (finalWinningTrades > finalTotalTrades) {
      return NextResponse.json({ 
        error: "Winning trades cannot exceed total trades",
        code: "WINNING_TRADES_EXCEED_TOTAL" 
      }, { status: 400 });
    }

    if (finalLosingTrades > finalTotalTrades) {
      return NextResponse.json({ 
        error: "Losing trades cannot exceed total trades",
        code: "LOSING_TRADES_EXCEED_TOTAL" 
      }, { status: 400 });
    }

    if (finalWinningTrades + finalLosingTrades > finalTotalTrades) {
      return NextResponse.json({ 
        error: "Winning trades plus losing trades cannot exceed total trades",
        code: "TRADES_SUM_EXCEED_TOTAL" 
      }, { status: 400 });
    }

    // Recalculate derived fields if base data changed
    if ('totalTrades' in updates || 'winningTrades' in updates) {
      updates.winRate = finalTotalTrades > 0 ? finalWinningTrades / finalTotalTrades : 0.0;
    }

    if ('winningTrades' in updates || 'losingTrades' in updates || 'avgWin' in updates || 'avgLoss' in updates) {
      const finalAvgWin = updates.avgWin ?? current.avgWin;
      const finalAvgLoss = updates.avgLoss ?? current.avgLoss;
      
      if (finalAvgLoss !== 0 && finalWinningTrades > 0) {
        const totalWins = finalWinningTrades * finalAvgWin;
        const totalLosses = Math.abs(finalLosingTrades * finalAvgLoss);
        updates.profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0.0;
      } else {
        updates.profitFactor = 0.0;
      }
    }

    const updated = await db.update(performanceMetrics)
      .set(updates)
      .where(eq(performanceMetrics.id, parseInt(id)))
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
    const existing = await db.select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Performance metrics not found' }, { status: 404 });
    }

    const deleted = await db.delete(performanceMetrics)
      .where(eq(performanceMetrics.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Performance metrics deleted successfully',
      deleted: deleted[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}