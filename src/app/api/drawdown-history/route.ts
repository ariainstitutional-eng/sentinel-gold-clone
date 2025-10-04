import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { drawdownHistory } from '@/db/schema';
import { eq, like, and, or, desc, asc, gte, lte } from 'drizzle-orm';

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
        .from(drawdownHistory)
        .where(eq(drawdownHistory.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ error: 'Drawdown record not found' }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    // List with filters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const recoveredFilter = searchParams.get('recovered');
    const minDrawdown = searchParams.get('minDrawdown');
    const sort = searchParams.get('sort') || 'timestamp';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(drawdownHistory);
    let conditions = [];

    // Time-based filtering
    if (fromDate) {
      const fromTimestamp = new Date(fromDate).getTime();
      if (!isNaN(fromTimestamp)) {
        conditions.push(gte(drawdownHistory.timestamp, fromTimestamp));
      }
    }

    if (toDate) {
      const toTimestamp = new Date(toDate).getTime();
      if (!isNaN(toTimestamp)) {
        conditions.push(lte(drawdownHistory.timestamp, toTimestamp));
      }
    }

    // Recovery status filter
    if (recoveredFilter !== null && recoveredFilter !== undefined) {
      const isRecovered = recoveredFilter === 'true';
      conditions.push(eq(drawdownHistory.recovered, isRecovered));
    }

    // Minimum drawdown percentage filter
    if (minDrawdown) {
      const minDrawdownPct = parseFloat(minDrawdown);
      if (!isNaN(minDrawdownPct)) {
        conditions.push(gte(drawdownHistory.drawdownPct, minDrawdownPct));
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sorting
    const sortColumn = drawdownHistory[sort as keyof typeof drawdownHistory] || drawdownHistory.timestamp;
    const orderBy = order === 'asc' ? asc(sortColumn) : desc(sortColumn);
    
    const results = await query
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Calculate statistics for metadata
    const statsQuery = await db.select().from(drawdownHistory);
    const totalRecords = statsQuery.length;
    const recoveredRecords = statsQuery.filter(r => r.recovered).length;
    const maxDrawdown = Math.max(...statsQuery.map(r => r.drawdownPct), 0);
    const avgDrawdown = statsQuery.length > 0 ? 
      statsQuery.reduce((sum, r) => sum + r.drawdownPct, 0) / statsQuery.length : 0;

    const response = NextResponse.json(results);
    response.headers.set('X-Total-Records', totalRecords.toString());
    response.headers.set('X-Recovered-Records', recoveredRecords.toString());
    response.headers.set('X-Max-Drawdown', maxDrawdown.toString());
    response.headers.set('X-Avg-Drawdown', avgDrawdown.toFixed(2));

    return response;
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { timestamp, equityPeak, currentEquity } = requestBody;

    // Validation
    if (!timestamp) {
      return NextResponse.json({ 
        error: "Timestamp is required",
        code: "MISSING_TIMESTAMP" 
      }, { status: 400 });
    }

    if (!equityPeak || equityPeak <= 0) {
      return NextResponse.json({ 
        error: "Equity peak must be greater than 0",
        code: "INVALID_EQUITY_PEAK" 
      }, { status: 400 });
    }

    if (!currentEquity || currentEquity <= 0) {
      return NextResponse.json({ 
        error: "Current equity must be greater than 0",
        code: "INVALID_CURRENT_EQUITY" 
      }, { status: 400 });
    }

    if (currentEquity > equityPeak) {
      return NextResponse.json({ 
        error: "Current equity cannot be greater than equity peak",
        code: "INVALID_EQUITY_VALUES" 
      }, { status: 400 });
    }

    // Validate timestamp
    const timestampNum = parseInt(timestamp);
    if (isNaN(timestampNum)) {
      return NextResponse.json({ 
        error: "Valid timestamp is required",
        code: "INVALID_TIMESTAMP" 
      }, { status: 400 });
    }

    // Auto-calculate drawdown values
    const drawdownAmount = equityPeak - currentEquity;
    const drawdownPct = (drawdownAmount / equityPeak) * 100;
    const recovered = currentEquity >= equityPeak;

    const insertData = {
      timestamp: timestampNum,
      equityPeak: parseFloat(equityPeak),
      currentEquity: parseFloat(currentEquity),
      drawdownPct: parseFloat(drawdownPct.toFixed(4)),
      drawdownAmount: parseFloat(drawdownAmount.toFixed(4)),
      recovered
    };

    const newRecord = await db.insert(drawdownHistory)
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

    const requestBody = await request.json();
    const { timestamp, equityPeak, currentEquity, recovered } = requestBody;

    // Check if record exists
    const existingRecord = await db.select()
      .from(drawdownHistory)
      .where(eq(drawdownHistory.id, parseInt(id)))
      .limit(1);

    if (existingRecord.length === 0) {
      return NextResponse.json({ error: 'Drawdown record not found' }, { status: 404 });
    }

    const current = existingRecord[0];
    let updates: any = {};

    // Validate and set individual fields
    if (timestamp !== undefined) {
      const timestampNum = parseInt(timestamp);
      if (isNaN(timestampNum)) {
        return NextResponse.json({ 
          error: "Valid timestamp is required",
          code: "INVALID_TIMESTAMP" 
        }, { status: 400 });
      }
      updates.timestamp = timestampNum;
    }

    if (equityPeak !== undefined) {
      if (equityPeak <= 0) {
        return NextResponse.json({ 
          error: "Equity peak must be greater than 0",
          code: "INVALID_EQUITY_PEAK" 
        }, { status: 400 });
      }
      updates.equityPeak = parseFloat(equityPeak);
    }

    if (currentEquity !== undefined) {
      if (currentEquity <= 0) {
        return NextResponse.json({ 
          error: "Current equity must be greater than 0",
          code: "INVALID_CURRENT_EQUITY" 
        }, { status: 400 });
      }
      updates.currentEquity = parseFloat(currentEquity);
    }

    // Use updated values or existing ones for calculations
    const finalEquityPeak = updates.equityPeak || current.equityPeak;
    const finalCurrentEquity = updates.currentEquity || current.currentEquity;

    // Validate equity relationship
    if (finalCurrentEquity > finalEquityPeak) {
      return NextResponse.json({ 
        error: "Current equity cannot be greater than equity peak",
        code: "INVALID_EQUITY_VALUES" 
      }, { status: 400 });
    }

    // Recalculate drawdown values if equity values changed
    if (updates.equityPeak !== undefined || updates.currentEquity !== undefined) {
      const drawdownAmount = finalEquityPeak - finalCurrentEquity;
      const drawdownPct = (drawdownAmount / finalEquityPeak) * 100;
      
      updates.drawdownAmount = parseFloat(drawdownAmount.toFixed(4));
      updates.drawdownPct = parseFloat(drawdownPct.toFixed(4));
    }

    // Handle recovery status
    if (recovered !== undefined) {
      updates.recovered = Boolean(recovered);
    } else if (updates.equityPeak !== undefined || updates.currentEquity !== undefined) {
      // Auto-update recovery status based on equity values
      updates.recovered = finalCurrentEquity >= finalEquityPeak;
    }

    const updated = await db.update(drawdownHistory)
      .set(updates)
      .where(eq(drawdownHistory.id, parseInt(id)))
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

    const deleted = await db.delete(drawdownHistory)
      .where(eq(drawdownHistory.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Drawdown record not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Drawdown record deleted successfully',
      deleted: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}