import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { riskLimits, auditLogs } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema
const positionSizeSchema = z.object({
  equity: z.number().positive().min(100, "Minimum equity of $100 required"),
  riskPerTradePct: z.number().min(0.1).max(5.0, "Risk percentage must be between 0.1% and 5.0%"),
  slPips: z.number().positive().min(1, "Stop loss must be at least 1 pip"),
  symbol: z.string().optional().default('XAUUSD'),
  maxPositions: z.number().int().positive().optional(),
  seed: z.number().int().optional().default(42)
});

// Symbol pip values (per 1 lot)
const PIP_VALUES = {
  'XAUUSD': 10.00,
  'EURUSD': 10.00,
  'GBPUSD': 10.00,
  'USDJPY': 9.09,
  'USDCHF': 10.00,
  'AUDUSD': 10.00,
  'USDCAD': 7.69,
  'NZDUSD': 10.00
} as const;

// Maximum position size limits (in lots)
const MAX_POSITION_LIMITS = {
  'XAUUSD': 50.00,
  'EURUSD': 100.00,
  'GBPUSD': 100.00,
  'USDJPY': 100.00,
  'USDCHF': 100.00,
  'AUDUSD': 100.00,
  'USDCAD': 100.00,
  'NZDUSD': 100.00
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = positionSizeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: validation.error.errors,
        code: "VALIDATION_ERROR"
      }, { status: 400 });
    }

    const { equity, riskPerTradePct, slPips, symbol, maxPositions, seed } = validation.data;

    // Get risk limits from database
    const riskLimit = await db.select()
      .from(riskLimits)
      .orderBy(desc(riskLimits.createdAt))
      .limit(1);

    if (riskLimit.length === 0) {
      return NextResponse.json({
        error: "Risk limits not configured",
        code: "RISK_LIMITS_NOT_FOUND"
      }, { status: 400 });
    }

    const limits = riskLimit[0];

    // Validate risk percentage against system limits
    if (riskPerTradePct > limits.maxRiskPerTradePct) {
      return NextResponse.json({
        error: `Risk per trade cannot exceed ${limits.maxRiskPerTradePct}%`,
        code: "RISK_LIMIT_EXCEEDED"
      }, { status: 400 });
    }

    // Get pip value for symbol
    const pipValue = PIP_VALUES[symbol as keyof typeof PIP_VALUES];
    if (!pipValue) {
      return NextResponse.json({
        error: `Unsupported symbol: ${symbol}`,
        code: "UNSUPPORTED_SYMBOL"
      }, { status: 400 });
    }

    // Get maximum positions limit
    const maxConcurrentPositions = maxPositions || limits.maxConcurrentPositions;

    // Apply deterministic seed for any stochastic elements
    Math.random = (() => {
      let localSeed = seed;
      return () => {
        localSeed = (localSeed * 9301 + 49297) % 233280;
        return localSeed / 233280;
      };
    })();

    // Calculate position size
    const riskAmount = equity * (riskPerTradePct / 100);
    const rawPositionSize = riskAmount / (slPips * pipValue);
    
    // Round to 2 decimal places (standard lot precision)
    let volume = Math.round(rawPositionSize * 100) / 100;

    // Apply maximum position size limit
    const maxPositionLimit = MAX_POSITION_LIMITS[symbol as keyof typeof MAX_POSITION_LIMITS] || 50.00;
    if (volume > maxPositionLimit) {
      volume = maxPositionLimit;
    }

    // Ensure minimum volume (most brokers require at least 0.01 lots)
    if (volume < 0.01) {
      volume = 0.01;
    }

    // Recalculate actual risk amount based on final volume
    const actualRiskAmount = volume * slPips * pipValue;

    const result = {
      volume: parseFloat(volume.toFixed(2)),
      riskAmount: parseFloat(actualRiskAmount.toFixed(2)),
      pipValue: pipValue,
      calculation: {
        equity,
        riskPerTradePct,
        slPips,
        maxPositions: maxConcurrentPositions,
        symbol,
        seed
      }
    };

    // Audit log the position size calculation
    await db.insert(auditLogs).values({
      timestamp: Date.now(),
      category: 'risk',
      action: 'position_size_calculated',
      details: JSON.stringify({
        input: { equity, riskPerTradePct, slPips, symbol },
        output: result,
        limits: {
          maxRiskPerTradePct: limits.maxRiskPerTradePct,
          maxConcurrentPositions,
          maxPositionLimit
        }
      }),
      level: 'info'
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('POST /api/risk/position-size error:', error);

    // Audit log the error
    try {
      await db.insert(auditLogs).values({
        timestamp: Date.now(),
        category: 'risk',
        action: 'position_size_error',
        details: `Position size calculation failed: ${error}`,
        level: 'error'
      });
    } catch (auditError) {
      console.error('Failed to log audit error:', auditError);
    }

    return NextResponse.json({
      error: 'Internal server error: ' + error,
      code: "INTERNAL_ERROR"
    }, { status: 500 });
  }
}