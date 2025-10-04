import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { MLTradingModel } from "@/lib/ml-model";
import { Backtester } from "@/lib/backtester";
import { TechnicalIndicators } from "@/lib/technical-indicators";
import path from "path";

// GET: Fetch all AI models
export async function GET() {
  try {
    const allModels = await db.query.models.findMany({
      orderBy: [desc(models.updatedAt)],
    });

    // Parse hyperparams and format response
    const formattedModels = allModels.map((model) => {
      const hyperparams = model.hyperparams as any;
      return {
        id: model.id,
        name: model.name,
        provider: model.provider,
        version: model.version,
        strategy: hyperparams?.strategy || "LSTM",
        symbol: hyperparams?.symbol || "XAUUSD",
        timeframe: hyperparams?.timeframe || "M5",
        status: model.status,
        accuracy: hyperparams?.metrics?.accuracy ? hyperparams.metrics.accuracy * 100 : 0,
        winRate: hyperparams?.metrics?.winRate ? hyperparams.metrics.winRate * 100 : 0,
        profitability: hyperparams?.metrics?.profitability ? hyperparams.metrics.profitability * 100 : 0,
        trainingData: hyperparams?.trainingData || null,
        backtestResults: hyperparams?.backtestResults || null,
        isActive: model.status === "active",
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      models: formattedModels,
    });
  } catch (error: any) {
    console.error("Failed to fetch models:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Start training a new model with REAL ML
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.modelName || !body.symbol || !body.timeframe || !body.fromDate || !body.toDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: modelName, symbol, timeframe, fromDate, toDate",
        },
        { status: 400 }
      );
    }

    // Training parameters
    const trainingParams = {
      learningRate: body.parameters?.learningRate || 0.001,
      epochs: body.parameters?.epochs || 50,
      batchSize: body.parameters?.batchSize || 32,
      validationSplit: body.parameters?.validationSplit || 0.2,
      sequenceLength: body.parameters?.sequenceLength || 60,
      lstmUnits: body.parameters?.lstmUnits || [128, 64, 32],
      dropout: body.parameters?.dropout || 0.2,
    };

    // Step 1: Fetch historical data
    console.log(`Fetching historical data for ${body.symbol} ${body.timeframe}...`);
    const historicalDataUrl = `${req.nextUrl.origin}/api/mt5/historical-data?symbol=${body.symbol}&timeframe=${body.timeframe}&limit=5000`;
    
    const historicalResponse = await fetch(historicalDataUrl);
    
    if (!historicalResponse.ok) {
      throw new Error("Failed to fetch historical data");
    }

    const historicalData = await historicalResponse.json();

    if (!historicalData.success || historicalData.bars.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No historical data available for training",
        },
        { status: 400 }
      );
    }

    console.log(`Received ${historicalData.bars.length} bars for training`);

    // Step 2: Create model record in database
    const [newModel] = await db
      .insert(models)
      .values({
        name: body.modelName,
        provider: "LSTM-AI",
        version: "1.0.0",
        description: `LSTM model trained on ${body.symbol} ${body.timeframe} data`,
        hyperparams: JSON.stringify({
          strategy: body.strategy || "LSTM",
          symbol: body.symbol,
          timeframe: body.timeframe,
          parameters: trainingParams,
          trainingData: {
            fromDate: body.fromDate,
            toDate: body.toDate,
            barCount: historicalData.bars.length,
          },
        }),
        status: "training",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .returning();

    // Step 3: Start REAL training (async)
    console.log(`Starting REAL LSTM training for model ${newModel.id}...`);

    // Start training in background
    trainModelAsync(newModel.id, historicalData.bars, trainingParams, body.symbol, body.timeframe).catch((error) => {
      console.error(`Training failed for model ${newModel.id}:`, error);
    });

    return NextResponse.json({
      success: true,
      modelId: newModel.id.toString(),
      status: "training",
      message: `Real LSTM training started for ${body.modelName} with ${historicalData.bars.length} historical bars.`,
    });
  } catch (error) {
    console.error("AI training error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start model training",
      },
      { status: 500 }
    );
  }
}

/**
 * Train model asynchronously
 */
async function trainModelAsync(
  modelId: number,
  bars: any[],
  trainingParams: any,
  symbol: string,
  timeframe: string
) {
  try {
    console.log(`[Model ${modelId}] Starting real ML training...`);

    // Convert bars to OHLCVData format
    const trainingData = bars.map((bar) => ({
      time: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume || 0,
    }));

    // Initialize ML model
    const mlModel = new MLTradingModel({
      sequenceLength: trainingParams.sequenceLength,
      epochs: trainingParams.epochs,
      batchSize: trainingParams.batchSize,
      learningRate: trainingParams.learningRate,
      validationSplit: trainingParams.validationSplit,
      lstmUnits: trainingParams.lstmUnits,
      dropout: trainingParams.dropout,
    });

    // Train model with progress logging
    const metrics = await mlModel.train(trainingData, (epoch, logs) => {
      if (epoch % 10 === 0) {
        console.log(`[Model ${modelId}] Epoch ${epoch}: loss=${logs?.loss.toFixed(4)}, acc=${logs?.acc.toFixed(4)}`);
      }
    });

    console.log(`[Model ${modelId}] Training complete! Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);

    // Save model
    const modelPath = path.join(process.cwd(), 'models', `model_${modelId}`);
    await mlModel.save(modelPath);

    // Run backtest
    console.log(`[Model ${modelId}] Running backtest...`);
    const backtester = new Backtester({
      initialCapital: 10000,
      riskPerTrade: 0.02,
      commission: 2,
      slippage: 0.5,
      maxPositions: 3,
    });

    // Generate signals using indicators
    const backtestResults = backtester.run(trainingData, (data, index) => {
      if (data.length < 100) return null;

      const indicators = TechnicalIndicators.calculateAllIndicators(data.slice(Math.max(0, index - 100), index + 1));
      const signals = TechnicalIndicators.generateSignals(data.slice(Math.max(0, index - 100), index + 1), indicators);
      const lastSignal = signals[signals.length - 1];

      if (lastSignal && lastSignal.signal !== 'HOLD' && lastSignal.strength > 0.5) {
        const currentBar = data[index];
        const atr = indicators[indicators.length - 1]?.atr || 10;

        return {
          signal: lastSignal.signal,
          stopLoss: lastSignal.signal === 'BUY' ? currentBar.close - atr * 2 : currentBar.close + atr * 2,
          takeProfit: lastSignal.signal === 'BUY' ? currentBar.close + atr * 4 : currentBar.close - atr * 4,
        };
      }

      return null;
    });

    console.log(`[Model ${modelId}] Backtest complete! Win Rate: ${backtestResults.winRate.toFixed(2)}%, Net Profit: $${backtestResults.netProfit.toFixed(2)}`);

    // Update model in database
    await db
      .update(models)
      .set({
        status: "active",
        hyperparams: JSON.stringify({
          strategy: "LSTM",
          symbol,
          timeframe,
          parameters: trainingParams,
          metrics: {
            accuracy: metrics.accuracy,
            precision: metrics.precision,
            recall: metrics.recall,
            f1Score: metrics.f1Score,
            loss: metrics.loss,
            valLoss: metrics.valLoss,
            winRate: metrics.winRate,
            profitability: metrics.profitability,
          },
          backtestResults: {
            totalTrades: backtestResults.totalTrades,
            winRate: backtestResults.winRate,
            netProfit: backtestResults.netProfit,
            netProfitPercentage: backtestResults.netProfitPercentage,
            profitFactor: backtestResults.profitFactor,
            sharpeRatio: backtestResults.sharpeRatio,
            maxDrawdown: backtestResults.maxDrawdown,
            maxDrawdownPercentage: backtestResults.maxDrawdownPercentage,
          },
          trainingData: {
            barCount: bars.length,
            completedAt: new Date().toISOString(),
          },
          modelPath,
        }),
        updatedAt: Date.now(),
      })
      .where(eq(models.id, modelId));

    console.log(`[Model ${modelId}] Training pipeline complete!`);
  } catch (error) {
    console.error(`[Model ${modelId}] Training failed:`, error);
    await db
      .update(models)
      .set({
        status: "failed",
        updatedAt: Date.now(),
      })
      .where(eq(models.id, modelId));
  }
}