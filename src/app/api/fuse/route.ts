import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { signals, fusedSignals, auditLogs } from '@/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { z } from 'zod';

const FuseRequestSchema = z.object({
  symbol: z.string().default('XAUUSD'),
  seed: z.number().int().default(42)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { symbol, seed } = FuseRequestSchema.parse(body);

    // Get latest signal from each layer within the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    const [primarySignals, sequentialSignals, contextualSignals] = await Promise.all([
      db.select()
        .from(signals)
        .where(and(
          eq(signals.symbol, symbol),
          eq(signals.layer, 'primary'),
          gte(signals.timestamp, oneHourAgo)
        ))
        .orderBy(desc(signals.timestamp))
        .limit(1),
      
      db.select()
        .from(signals)
        .where(and(
          eq(signals.symbol, symbol),
          eq(signals.layer, 'sequential'),
          gte(signals.timestamp, oneHourAgo)
        ))
        .orderBy(desc(signals.timestamp))
        .limit(1),
      
      db.select()
        .from(signals)
        .where(and(
          eq(signals.symbol, symbol),
          eq(signals.layer, 'contextual'),
          gte(signals.timestamp, oneHourAgo)
        ))
        .orderBy(desc(signals.timestamp))
        .limit(1)
    ]);

    const primary = primarySignals[0];
    const sequential = sequentialSignals[0];
    const contextual = contextualSignals[0];

    // Count available layers
    const layers = [primary, sequential, contextual].filter(Boolean);
    
    if (layers.length < 2) {
      return NextResponse.json({ 
        error: "Insufficient signals for fusion - at least 2 layers required",
        code: "INSUFFICIENT_SIGNALS",
        available: layers.length
      }, { status: 400 });
    }

    // Determine weights based on available layers
    let primaryWeight = 0, sequentialWeight = 0, contextualWeight = 0;
    
    if (layers.length === 3) {
      primaryWeight = 0.5;
      sequentialWeight = 0.3;
      contextualWeight = 0.2;
    } else if (layers.length === 2) {
      if (primary && sequential) {
        primaryWeight = 0.625; // 0.5 / 0.8
        sequentialWeight = 0.375; // 0.3 / 0.8
      } else if (primary && contextual) {
        primaryWeight = 0.714; // 0.5 / 0.7
        contextualWeight = 0.286; // 0.2 / 0.7
      } else if (sequential && contextual) {
        sequentialWeight = 0.6; // 0.3 / 0.5
        contextualWeight = 0.4; // 0.2 / 0.5
      }
    }

    // Calculate fusion score
    let score = 0;
    if (primary) score += primaryWeight * primary.strength;
    if (sequential) score += sequentialWeight * sequential.strength;
    if (contextual) score += contextualWeight * contextual.strength;

    // Calculate average confidence
    const confidences = layers.map(layer => layer.confidence);
    const confidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

    // Determine direction by majority vote
    const directions = layers.map(layer => layer.direction);
    const buyCount = directions.filter(d => d === 'buy').length;
    const sellCount = directions.filter(d => d === 'sell').length;
    const neutralCount = directions.filter(d => d === 'neutral').length;

    let direction: string;
    if (buyCount > sellCount && buyCount > neutralCount) {
      direction = 'buy';
    } else if (sellCount > buyCount && sellCount > neutralCount) {
      direction = 'sell';
    } else if (buyCount === sellCount && buyCount > neutralCount) {
      direction = 'buy'; // Tie-breaker: buy beats sell
    } else {
      direction = 'neutral';
    }

    // Generate rationale
    const layerDescriptions = [];
    if (primary) {
      layerDescriptions.push(`Primary layer (${primary.direction}, strength: ${primary.strength.toFixed(2)}, confidence: ${primary.confidence.toFixed(2)})`);
    }
    if (sequential) {
      layerDescriptions.push(`Sequential layer (${sequential.direction}, strength: ${sequential.strength.toFixed(2)}, confidence: ${sequential.confidence.toFixed(2)})`);
    }
    if (contextual) {
      layerDescriptions.push(`Contextual layer (${contextual.direction}, strength: ${contextual.strength.toFixed(2)}, confidence: ${contextual.confidence.toFixed(2)})`);
    }

    const rationale = `Signal fusion for ${symbol} using ${layers.length} layers with seed ${seed}. ` +
      `Inputs: ${layerDescriptions.join(', ')}. ` +
      `Weighted score calculation: ${score.toFixed(3)} (weights: primary=${primaryWeight.toFixed(3)}, sequential=${sequentialWeight.toFixed(3)}, contextual=${contextualWeight.toFixed(3)}). ` +
      `Direction determined by majority vote: ${buyCount} buy, ${sellCount} sell, ${neutralCount} neutral votes = ${direction}. ` +
      `Average confidence: ${confidence.toFixed(3)}.`;

    // Store fused signal
    const timestamp = Date.now();
    const fusedSignal = await db.insert(fusedSignals)
      .values({
        timestamp,
        symbol,
        direction,
        score,
        confidence,
        primaryId: primary?.id || null,
        sequentialId: sequential?.id || null,
        contextualId: contextual?.id || null,
        rationale,
        seed
      })
      .returning();

    // Log fusion event
    await db.insert(auditLogs)
      .values({
        timestamp,
        category: 'execution',
        action: 'signal_fusion',
        details: `Fused ${layers.length} signals for ${symbol}: ${direction} (score: ${score.toFixed(3)}, confidence: ${confidence.toFixed(3)})`,
        refType: 'fused_signal',
        refId: fusedSignal[0].id,
        level: 'info'
      });

    return NextResponse.json(fusedSignal[0], { status: 201 });

  } catch (error) {
    console.error('POST /api/fuse error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid request parameters",
        code: "VALIDATION_ERROR",
        details: error.errors
      }, { status: 400 });
    }

    // Log error event
    try {
      await db.insert(auditLogs)
        .values({
          timestamp: Date.now(),
          category: 'system',
          action: 'fusion_error',
          details: `Signal fusion failed: ${error}`,
          level: 'error'
        });
    } catch (logError) {
      console.error('Failed to log fusion error:', logError);
    }

    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}