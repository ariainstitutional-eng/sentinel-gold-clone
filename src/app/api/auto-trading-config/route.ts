import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { autoTradingConfig } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';

// Helper function to validate time format (HH:MM)
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

// Helper function to validate trading hours
function isValidTradingHours(start: string, end: string): boolean {
  if (!isValidTimeFormat(start) || !isValidTimeFormat(end)) {
    return false;
  }
  
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return startMinutes < endMinutes;
}

// Helper function to validate JSON array of strings
function isValidSymbolsArray(value: any): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(item => typeof item === 'string' && item.length > 0);
}

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

      const config = await db.select()
        .from(autoTradingConfig)
        .where(eq(autoTradingConfig.id, parseInt(id)))
        .limit(1);

      if (config.length === 0) {
        return NextResponse.json({ 
          error: 'Configuration not found' 
        }, { status: 404 });
      }

      return NextResponse.json(config[0]);
    }

    // List with pagination, filtering, and search
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const enabled = searchParams.get('enabled');
    const sort = searchParams.get('sort') || 'updatedAt';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(autoTradingConfig);

    // Build where conditions
    let conditions = [];

    // Filter by enabled status
    if (enabled !== null) {
      const enabledBool = enabled === 'true';
      conditions.push(eq(autoTradingConfig.enabled, enabledBool));
    }

    // Search across strategy-related fields
    if (search) {
      const searchCondition = or(
        like(autoTradingConfig.allowedSymbols, `%${search}%`),
        like(autoTradingConfig.tradingHoursStart, `%${search}%`),
        like(autoTradingConfig.tradingHoursEnd, `%${search}%`)
      );
      conditions.push(searchCondition);
    }

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const orderDirection = order.toLowerCase() === 'asc' ? asc : desc;
    const sortField = sort === 'createdAt' ? autoTradingConfig.createdAt : autoTradingConfig.updatedAt;
    query = query.orderBy(orderDirection(sortField));

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
    const requestBody = await request.json();
    const {
      enabled,
      maxDailyTrades,
      maxDailyLoss,
      maxPositionSize,
      emergencyStopLoss,
      tradingHoursStart,
      tradingHoursEnd,
      allowedSymbols,
      minConfidenceThreshold,
      riskPerTrade
    } = requestBody;

    // Validation
    if (maxDailyTrades !== undefined && (maxDailyTrades < 1 || maxDailyTrades > 100)) {
      return NextResponse.json({ 
        error: "maxDailyTrades must be between 1 and 100",
        code: "INVALID_MAX_DAILY_TRADES" 
      }, { status: 400 });
    }

    if (maxDailyLoss !== undefined && (maxDailyLoss < 1.0 || maxDailyLoss > 10000.0)) {
      return NextResponse.json({ 
        error: "maxDailyLoss must be between 1.0 and 10000.0",
        code: "INVALID_MAX_DAILY_LOSS" 
      }, { status: 400 });
    }

    if (maxPositionSize !== undefined && (maxPositionSize < 0.01 || maxPositionSize > 100.0)) {
      return NextResponse.json({ 
        error: "maxPositionSize must be between 0.01 and 100.0",
        code: "INVALID_MAX_POSITION_SIZE" 
      }, { status: 400 });
    }

    if (minConfidenceThreshold !== undefined && (minConfidenceThreshold < 0.1 || minConfidenceThreshold > 1.0)) {
      return NextResponse.json({ 
        error: "minConfidenceThreshold must be between 0.1 and 1.0",
        code: "INVALID_MIN_CONFIDENCE_THRESHOLD" 
      }, { status: 400 });
    }

    if (riskPerTrade !== undefined && (riskPerTrade < 0.1 || riskPerTrade > 10.0)) {
      return NextResponse.json({ 
        error: "riskPerTrade must be between 0.1 and 10.0",
        code: "INVALID_RISK_PER_TRADE" 
      }, { status: 400 });
    }

    // Validate trading hours
    const startTime = tradingHoursStart || '00:00';
    const endTime = tradingHoursEnd || '23:59';
    
    if (!isValidTradingHours(startTime, endTime)) {
      return NextResponse.json({ 
        error: "Invalid trading hours format (HH:MM) or start time must be before end time",
        code: "INVALID_TRADING_HOURS" 
      }, { status: 400 });
    }

    // Validate allowedSymbols
    const symbols = allowedSymbols || ['XAUUSD'];
    if (!isValidSymbolsArray(symbols)) {
      return NextResponse.json({ 
        error: "allowedSymbols must be a valid JSON array of strings",
        code: "INVALID_ALLOWED_SYMBOLS" 
      }, { status: 400 });
    }

    const now = Date.now();
    const insertData = {
      enabled: enabled ?? false,
      maxDailyTrades: maxDailyTrades ?? 10,
      maxDailyLoss: maxDailyLoss ?? 500.0,
      maxPositionSize: maxPositionSize ?? 1.0,
      emergencyStopLoss: emergencyStopLoss ?? true,
      tradingHoursStart: startTime,
      tradingHoursEnd: endTime,
      allowedSymbols: JSON.stringify(symbols),
      minConfidenceThreshold: minConfidenceThreshold ?? 0.7,
      riskPerTrade: riskPerTrade ?? 1.0,
      createdAt: now,
      updatedAt: now
    };

    const newConfig = await db.insert(autoTradingConfig)
      .values(insertData)
      .returning();

    return NextResponse.json(newConfig[0], { status: 201 });
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
      .from(autoTradingConfig)
      .where(eq(autoTradingConfig.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Configuration not found' 
      }, { status: 404 });
    }

    const requestBody = await request.json();
    const updates: any = {};

    // Validate and build updates object
    if ('enabled' in requestBody) {
      updates.enabled = requestBody.enabled;
    }

    if ('maxDailyTrades' in requestBody) {
      if (requestBody.maxDailyTrades < 1 || requestBody.maxDailyTrades > 100) {
        return NextResponse.json({ 
          error: "maxDailyTrades must be between 1 and 100",
          code: "INVALID_MAX_DAILY_TRADES" 
        }, { status: 400 });
      }
      updates.maxDailyTrades = requestBody.maxDailyTrades;
    }

    if ('maxDailyLoss' in requestBody) {
      if (requestBody.maxDailyLoss < 1.0 || requestBody.maxDailyLoss > 10000.0) {
        return NextResponse.json({ 
          error: "maxDailyLoss must be between 1.0 and 10000.0",
          code: "INVALID_MAX_DAILY_LOSS" 
        }, { status: 400 });
      }
      updates.maxDailyLoss = requestBody.maxDailyLoss;
    }

    if ('maxPositionSize' in requestBody) {
      if (requestBody.maxPositionSize < 0.01 || requestBody.maxPositionSize > 100.0) {
        return NextResponse.json({ 
          error: "maxPositionSize must be between 0.01 and 100.0",
          code: "INVALID_MAX_POSITION_SIZE" 
        }, { status: 400 });
      }
      updates.maxPositionSize = requestBody.maxPositionSize;
    }

    if ('emergencyStopLoss' in requestBody) {
      updates.emergencyStopLoss = requestBody.emergencyStopLoss;
    }

    if ('minConfidenceThreshold' in requestBody) {
      if (requestBody.minConfidenceThreshold < 0.1 || requestBody.minConfidenceThreshold > 1.0) {
        return NextResponse.json({ 
          error: "minConfidenceThreshold must be between 0.1 and 1.0",
          code: "INVALID_MIN_CONFIDENCE_THRESHOLD" 
        }, { status: 400 });
      }
      updates.minConfidenceThreshold = requestBody.minConfidenceThreshold;
    }

    if ('riskPerTrade' in requestBody) {
      if (requestBody.riskPerTrade < 0.1 || requestBody.riskPerTrade > 10.0) {
        return NextResponse.json({ 
          error: "riskPerTrade must be between 0.1 and 10.0",
          code: "INVALID_RISK_PER_TRADE" 
        }, { status: 400 });
      }
      updates.riskPerTrade = requestBody.riskPerTrade;
    }

    // Validate trading hours if provided
    if ('tradingHoursStart' in requestBody || 'tradingHoursEnd' in requestBody) {
      const currentConfig = existing[0];
      const startTime = requestBody.tradingHoursStart || currentConfig.tradingHoursStart;
      const endTime = requestBody.tradingHoursEnd || currentConfig.tradingHoursEnd;
      
      if (!isValidTradingHours(startTime, endTime)) {
        return NextResponse.json({ 
          error: "Invalid trading hours format (HH:MM) or start time must be before end time",
          code: "INVALID_TRADING_HOURS" 
        }, { status: 400 });
      }
      
      if ('tradingHoursStart' in requestBody) {
        updates.tradingHoursStart = requestBody.tradingHoursStart;
      }
      if ('tradingHoursEnd' in requestBody) {
        updates.tradingHoursEnd = requestBody.tradingHoursEnd;
      }
    }

    // Validate allowedSymbols if provided
    if ('allowedSymbols' in requestBody) {
      if (!isValidSymbolsArray(requestBody.allowedSymbols)) {
        return NextResponse.json({ 
          error: "allowedSymbols must be a valid JSON array of strings",
          code: "INVALID_ALLOWED_SYMBOLS" 
        }, { status: 400 });
      }
      updates.allowedSymbols = JSON.stringify(requestBody.allowedSymbols);
    }

    // Always update updatedAt
    updates.updatedAt = Date.now();

    const updated = await db.update(autoTradingConfig)
      .set(updates)
      .where(eq(autoTradingConfig.id, parseInt(id)))
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
      .from(autoTradingConfig)
      .where(eq(autoTradingConfig.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Configuration not found' 
      }, { status: 404 });
    }

    const deleted = await db.delete(autoTradingConfig)
      .where(eq(autoTradingConfig.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Configuration deleted successfully',
      deleted: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}