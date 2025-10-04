import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { signals, models, auditLogs } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const signalCreateSchema = z.object({
  layer: z.enum(['primary', 'sequential', 'contextual']),
  direction: z.enum(['buy', 'sell', 'neutral']),
  strength: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  modelId: z.number().int().positive(),
  symbol: z.string().optional(),
  features: z.record(z.any()).optional(),
  seed: z.number().int().optional()
});

// Helper function to get bearer token from request headers
function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.substring(7);
  }
  return null;
}

// Helper function to log audit entry
async function logAudit(action: string, details: string, refType?: string, refId?: number) {
  try {
    await db.insert(auditLogs).values({
      timestamp: Math.floor(Date.now() / 1000),
      category: 'model',
      action,
      details,
      refType,
      refId,
      level: 'info'
    });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const bearerToken = getBearerToken(request);
    
    // Validate request body
    const validation = signalCreateSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json({ 
        error: validation.error.errors.map(e => e.message).join(', '),
        code: "VALIDATION_ERROR" 
      }, { status: 400 });
    }

    const { layer, direction, strength, confidence, modelId, symbol, features, seed } = validation.data;

    // Validate modelId exists
    const model = await db.select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);

    if (model.length === 0) {
      return NextResponse.json({ 
        error: "Model not found with provided modelId",
        code: "MODEL_NOT_FOUND" 
      }, { status: 400 });
    }

    // Generate Unix timestamp
    const timestamp = Math.floor(Date.now() / 1000);

    // Prepare insert data with defaults
    const insertData = {
      timestamp,
      symbol: symbol || 'XAUUSD',
      layer,
      direction,
      strength,
      confidence,
      features: features || null,
      modelId,
      seed: seed || 42
    };

    // Create new signal
    const newSignal = await db.insert(signals)
      .values(insertData)
      .returning();

    if (newSignal.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to create signal' 
      }, { status: 500 });
    }

    const createdSignal = newSignal[0];

    // Log audit entry
    const auditDetails = `Signal created: ${layer} layer, ${direction} direction, strength ${strength}, confidence ${confidence}, model ${modelId}${bearerToken ? ` (token: ${bearerToken.substring(0, 8)}...)` : ''}`;
    await logAudit('signal_created', auditDetails, 'signal', createdSignal.id);

    return NextResponse.json(createdSignal, { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const symbol = searchParams.get('symbol') || 'XAUUSD';
    const layer = searchParams.get('layer');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = db.select().from(signals);
    let conditions = [];

    // Apply filters
    if (symbol) {
      conditions.push(eq(signals.symbol, symbol));
    } else {
      // Default to XAUUSD if no symbol specified
      conditions.push(eq(signals.symbol, 'XAUUSD'));
    }

    if (layer && ['primary', 'sequential', 'contextual'].includes(layer)) {
      conditions.push(eq(signals.layer, layer));
    }

    // Search across multiple fields
    if (search) {
      const searchCondition = or(
        like(signals.symbol, `%${search}%`),
        like(signals.layer, `%${search}%`),
        like(signals.direction, `%${search}%`)
      );
      conditions.push(searchCondition);
    }

    // Apply conditions if any exist
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Order by timestamp DESC (newest first) and apply pagination
    const results = await query
      .orderBy(desc(signals.timestamp))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}