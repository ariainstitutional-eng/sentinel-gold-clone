import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models, signals } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId, symbol, currentPrice, timeframe } = body;

    if (!modelId || !symbol || !currentPrice) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: modelId, symbol, currentPrice" },
        { status: 400 }
      );
    }

    // Get model details
    const model = await db.query.models.findFirst({
      where: eq(models.id, parseInt(modelId)),
    });

    if (!model) {
      return NextResponse.json(
        { success: false, error: "Model not found" },
        { status: 404 }
      );
    }

    // Parse hyperparams to get strategy and accuracy
    const hyperparams = model.hyperparams as any;
    const strategy = hyperparams?.strategy || "momentum";
    const accuracy = hyperparams?.accuracy || Math.random() * 0.2 + 0.7;

    // Generate prediction based on strategy
    const prediction = generatePrediction(strategy, currentPrice, accuracy);

    // Insert signal into database with all required fields
    const [newSignal] = await db.insert(signals).values({
      timestamp: Date.now(),
      symbol,
      layer: "AI",
      direction: prediction.direction.toUpperCase(),
      strength: prediction.strength,
      confidence: prediction.confidence,
      features: JSON.stringify(prediction.features),
      seed: Math.floor(Math.random() * 1000000),
      action: prediction.action,
      entryPrice: prediction.entryPrice,
      stopLoss: prediction.stopLoss,
      takeProfit: prediction.takeProfit,
      reason: prediction.reason,
      modelId: parseInt(modelId),
      status: "pending",
      createdAt: Date.now(),
    }).returning();

    return NextResponse.json({
      success: true,
      signal: newSignal,
      prediction,
    });
  } catch (error: any) {
    console.error("Prediction error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function generatePrediction(strategy: string, currentPrice: number, accuracy: number) {
  // Simulate AI prediction logic
  const trend = (Math.random() - 0.5) * 0.02; // -1% to +1%
  const volatility = Math.random() * 0.01; // 0% to 1%
  
  let direction: "buy" | "sell" | "hold";
  let strength: number;
  let confidence: number = accuracy;

  if (Math.abs(trend) < 0.003) {
    direction = "hold";
    strength = 0.3;
  } else if (trend > 0) {
    direction = "buy";
    strength = Math.min(Math.abs(trend) * 50, 1);
  } else {
    direction = "sell";
    strength = Math.min(Math.abs(trend) * 50, 1);
  }

  // Calculate entry, SL, TP based on direction
  const entryPrice = currentPrice;
  const slDistance = currentPrice * 0.015; // 1.5% SL
  const tpDistance = currentPrice * 0.03; // 3% TP (2:1 RR)

  let stopLoss: number;
  let takeProfit: number;

  if (direction === "buy") {
    stopLoss = entryPrice - slDistance;
    takeProfit = entryPrice + tpDistance;
  } else if (direction === "sell") {
    stopLoss = entryPrice + slDistance;
    takeProfit = entryPrice - tpDistance;
  } else {
    stopLoss = entryPrice - slDistance;
    takeProfit = entryPrice + tpDistance;
  }

  const features = {
    trend: (trend * 100).toFixed(3),
    volatility: (volatility * 100).toFixed(3),
    rsi: Math.random() * 100,
    momentum: Math.random() * 2 - 1,
  };

  const reason = `${strategy.charAt(0).toUpperCase() + strategy.slice(1)} strategy detected ${direction.toUpperCase()} opportunity. Trend: ${features.trend}%, Volatility: ${features.volatility}%. Model accuracy: ${(accuracy * 100).toFixed(1)}%.`;

  return {
    direction,
    action: direction,
    strength,
    confidence,
    entryPrice: parseFloat(entryPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    takeProfit: parseFloat(takeProfit.toFixed(2)),
    reason,
    features,
  };
}