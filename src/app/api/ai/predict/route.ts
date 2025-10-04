import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models, signals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { MLTradingModel } from "@/lib/ml-model";
import { TechnicalIndicators } from "@/lib/technical-indicators";
import path from "path";

// POST: Generate prediction using REAL trained model
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.modelId) {
      return NextResponse.json(
        { success: false, error: "Model ID is required" },
        { status: 400 }
      );
    }

    // Fetch model from database
    const [model] = await db
      .select()
      .from(models)
      .where(eq(models.id, parseInt(body.modelId)))
      .limit(1);

    if (!model) {
      return NextResponse.json(
        { success: false, error: "Model not found" },
        { status: 404 }
      );
    }

    if (model.status !== "active") {
      return NextResponse.json(
        { success: false, error: `Model status is ${model.status}, not active` },
        { status: 400 }
      );
    }

    const hyperparams = model.hyperparams as any;
    const symbol = hyperparams?.symbol || body.symbol || "XAUUSD";
    const timeframe = hyperparams?.timeframe || body.timeframe || "M5";

    // Fetch recent historical data for prediction
    console.log(`Fetching recent data for prediction on ${symbol} ${timeframe}...`);
    const historicalDataUrl = `${req.nextUrl.origin}/api/mt5/historical-data?symbol=${symbol}&timeframe=${timeframe}&limit=200`;
    
    const historicalResponse = await fetch(historicalDataUrl);
    
    if (!historicalResponse.ok) {
      throw new Error("Failed to fetch historical data");
    }

    const historicalData = await historicalResponse.json();

    if (!historicalData.success || historicalData.bars.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No historical data available for prediction",
        },
        { status: 400 }
      );
    }

    // Convert to OHLCVData format
    const recentData = historicalData.bars.map((bar: any) => ({
      time: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume || 0,
    }));

    // Load and use real ML model
    const modelPath = hyperparams?.modelPath;
    
    if (!modelPath) {
      return NextResponse.json(
        { success: false, error: "Model path not found. Model may not be fully trained." },
        { status: 400 }
      );
    }

    console.log(`Loading model from ${modelPath}...`);
    const mlModel = new MLTradingModel({
      sequenceLength: hyperparams?.parameters?.sequenceLength || 60,
    });

    try {
      await mlModel.load(modelPath);
      console.log(`Model loaded successfully`);
    } catch (error) {
      console.error("Error loading model:", error);
      // Fallback to indicator-based prediction if model loading fails
      return await fallbackIndicatorPrediction(symbol, recentData);
    }

    // Make real prediction
    const prediction = await mlModel.predict(recentData);

    console.log(`Prediction: ${prediction.signal}, Confidence: ${(prediction.confidence * 100).toFixed(2)}%`);

    // Also calculate technical indicators for additional context
    const indicators = TechnicalIndicators.calculateAllIndicators(recentData);
    const lastIndicator = indicators[indicators.length - 1];

    // Get current price
    const currentPrice = recentData[recentData.length - 1].close;

    // Create signal in database
    const [signal] = await db
      .insert(signals)
      .values({
        timestamp: Date.now(),
        symbol,
        layer: "ML-LSTM",
        direction: prediction.signal,
        strength: prediction.confidence,
        confidence: prediction.confidence,
        features: JSON.stringify({
          rsi: lastIndicator.rsi,
          macd: lastIndicator.macd,
          stochastic: lastIndicator.stochastic,
          adx: lastIndicator.adx,
        }),
        seed: null,
        action: prediction.signal.toLowerCase(),
        entryPrice: currentPrice,
        stopLoss: prediction.stopLoss,
        takeProfit: prediction.takeProfit,
        reason: `ML prediction: ${prediction.signal} with ${(prediction.confidence * 100).toFixed(2)}% confidence. Expected return: ${prediction.expectedReturn.toFixed(2)}%`,
        modelId: model.id,
        status: "active",
        createdAt: Date.now(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      prediction: {
        signal: prediction.signal,
        confidence: prediction.confidence,
        currentPrice,
        predictedPrice: prediction.predictedPrice,
        expectedReturn: prediction.expectedReturn,
        stopLoss: prediction.stopLoss,
        takeProfit: prediction.takeProfit,
        indicators: {
          rsi: lastIndicator.rsi,
          macd: lastIndicator.macd.MACD,
          macdSignal: lastIndicator.macd.signal,
          adx: lastIndicator.adx,
        },
      },
      signalId: signal.id,
      model: {
        id: model.id,
        name: model.name,
        accuracy: hyperparams?.metrics?.accuracy || 0,
        winRate: hyperparams?.metrics?.winRate || 0,
      },
    });
  } catch (error: any) {
    console.error("Prediction error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate prediction",
      },
      { status: 500 }
    );
  }
}

/**
 * Fallback to indicator-based prediction if ML model fails
 */
async function fallbackIndicatorPrediction(symbol: string, recentData: any[]) {
  console.log("Using fallback indicator-based prediction...");
  
  const indicators = TechnicalIndicators.calculateAllIndicators(recentData);
  const signals = TechnicalIndicators.generateSignals(recentData, indicators);
  const lastSignal = signals[signals.length - 1];
  const lastIndicator = indicators[indicators.length - 1];
  const currentPrice = recentData[recentData.length - 1].close;

  const atr = lastIndicator.atr || 10;

  return NextResponse.json({
    success: true,
    prediction: {
      signal: lastSignal.signal,
      confidence: lastSignal.strength,
      currentPrice,
      predictedPrice: lastSignal.signal === 'BUY' 
        ? currentPrice * 1.01 
        : lastSignal.signal === 'SELL' 
          ? currentPrice * 0.99 
          : currentPrice,
      expectedReturn: lastSignal.signal === 'BUY' 
        ? 1.0 
        : lastSignal.signal === 'SELL' 
          ? -1.0 
          : 0,
      stopLoss: lastSignal.signal === 'BUY' 
        ? currentPrice - atr * 2 
        : lastSignal.signal === 'SELL'
          ? currentPrice + atr * 2
          : currentPrice,
      takeProfit: lastSignal.signal === 'BUY' 
        ? currentPrice + atr * 4 
        : lastSignal.signal === 'SELL'
          ? currentPrice - atr * 4
          : currentPrice,
      indicators: {
        rsi: lastIndicator.rsi,
        macd: lastIndicator.macd.MACD,
        macdSignal: lastIndicator.macd.signal,
        adx: lastIndicator.adx,
      },
    },
    note: "Using technical indicators (ML model not available)",
  });
}