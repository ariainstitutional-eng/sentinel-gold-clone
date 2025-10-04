import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fusedSignals } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'XAUUSD';
    const limitParam = searchParams.get('limit') || '1';
    const bearerToken = request.headers.get('Authorization');

    // Log bearer token if provided
    if (bearerToken) {
      console.log('Bearer token provided for latest fused signals request');
    }

    // Validate limit parameter
    const limit = parseInt(limitParam);
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json({ 
        error: "Limit must be a positive integer",
        code: "INVALID_LIMIT" 
      }, { status: 400 });
    }

    if (limit > 10) {
      return NextResponse.json({ 
        error: "Limit cannot exceed 10",
        code: "LIMIT_EXCEEDED" 
      }, { status: 400 });
    }

    // Validate symbol format
    if (!symbol || symbol.trim().length === 0) {
      return NextResponse.json({ 
        error: "Symbol is required and cannot be empty",
        code: "INVALID_SYMBOL" 
      }, { status: 400 });
    }

    // Query for latest fused signals
    const results = await db.select({
      id: fusedSignals.id,
      timestamp: fusedSignals.timestamp,
      symbol: fusedSignals.symbol,
      direction: fusedSignals.direction,
      score: fusedSignals.score,
      confidence: fusedSignals.confidence,
      primaryId: fusedSignals.primaryId,
      sequentialId: fusedSignals.sequentialId,
      contextualId: fusedSignals.contextualId,
      rationale: fusedSignals.rationale,
      seed: fusedSignals.seed
    })
    .from(fusedSignals)
    .where(eq(fusedSignals.symbol, symbol.trim().toUpperCase()))
    .orderBy(desc(fusedSignals.timestamp))
    .limit(limit);

    // Handle no results
    if (results.length === 0) {
      return NextResponse.json({ 
        error: `No fused signals found for symbol ${symbol}`,
        code: "NO_SIGNALS_FOUND" 
      }, { status: 404 });
    }

    // Return single object if limit=1, array if limit>1
    if (limit === 1) {
      return NextResponse.json(results[0], { status: 200 });
    } else {
      return NextResponse.json(results, { status: 200 });
    }

  } catch (error) {
    console.error('GET latest fused signals error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}