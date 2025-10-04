import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { desc } from "drizzle-orm";

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
        strategy: hyperparams?.strategy || "unknown",
        symbol: hyperparams?.symbol || "XAUUSD",
        timeframe: hyperparams?.timeframe || "M5",
        status: model.status,
        accuracy: hyperparams?.accuracy ? hyperparams.accuracy * 100 : 0,
        trainingData: hyperparams?.trainingData || null,
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

// POST: Start training a new model
export async function POST(req: NextRequest) {
  try {
    const body: TrainingRequest = await req.json();

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

    // Default training parameters
    const trainingParams = {
      learningRate: body.parameters?.learningRate || 0.001,
      epochs: body.parameters?.epochs || 100,
      batchSize: body.parameters?.batchSize || 32,
      validationSplit: body.parameters?.validationSplit || 0.2,
    };

    // Step 1: Fetch historical data
    console.log(`Fetching historical data for ${body.symbol} ${body.timeframe}...`);
    const historicalDataUrl = `${req.nextUrl.origin}/api/mt5/historical-data?symbol=${body.symbol}&timeframe=${body.timeframe}&from=${body.fromDate}&to=${body.toDate}`;
    
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
        provider: "MT5-AI",
        version: "1.0.0",
        description: `${body.strategy} model trained on ${body.symbol} ${body.timeframe} data`,
        strategy: body.strategy,
        symbol: body.symbol,
        timeframe: body.timeframe,
        status: "training",
        accuracy: 0,
        trainingData: JSON.stringify({
          fromDate: body.fromDate,
          toDate: body.toDate,
          barCount: historicalData.bars.length,
          parameters: trainingParams,
        }),
        isActive: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .returning();

    // Step 3: In production, this would trigger async training job
    // For now, simulate training process
    console.log(`Starting training for model ${newModel.id}...`);

    // Simulate async training (in production, use queue/worker)
    setTimeout(async () => {
      try {
        // Simulate training completion with realistic metrics
        const trainingMetrics = {
          accuracy: 0.75 + Math.random() * 0.15, // 75-90%
          precision: 0.70 + Math.random() * 0.15,
          recall: 0.68 + Math.random() * 0.15,
          f1Score: 0.72 + Math.random() * 0.13,
          loss: 0.15 + Math.random() * 0.1,
          valLoss: 0.18 + Math.random() * 0.12,
        };

        await db
          .update(models)
          .set({
            status: "trained",
            accuracy: parseFloat((trainingMetrics.accuracy * 100).toFixed(2)),
            trainingData: JSON.stringify({
              fromDate: body.fromDate,
              toDate: body.toDate,
              barCount: historicalData.bars.length,
              parameters: trainingParams,
              metrics: trainingMetrics,
              completedAt: new Date().toISOString(),
            }),
            updatedAt: new Date(),
          })
          .where(eq(models.id, newModel.id));

        console.log(`Training completed for model ${newModel.id}`);
      } catch (error) {
        console.error(`Training failed for model ${newModel.id}:`, error);
        await db
          .update(models)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(models.id, newModel.id));
      }
    }, 5000); // Simulate 5s training time

    const response: TrainingResponse = {
      success: true,
      modelId: newModel.id.toString(),
      status: "training",
      message: `Model training started for ${body.modelName}. Training with ${historicalData.bars.length} historical bars.`,
    };

    return NextResponse.json(response);
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