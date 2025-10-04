/**
 * Real ML Model Trainer using TensorFlow.js
 * LSTM/GRU networks for time series prediction
 */

import * as tf from '@tensorflow/tfjs-node';
import { OHLCVData, TechnicalIndicators } from './technical-indicators';

export interface TrainingConfig {
  sequenceLength: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  lstmUnits: number[];
  dropout: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  loss: number;
  valLoss: number;
  winRate: number;
  profitability: number;
}

export interface PredictionResult {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  predictedPrice: number;
  expectedReturn: number;
  stopLoss: number;
  takeProfit: number;
}

export class MLTradingModel {
  private model: tf.LayersModel | null = null;
  private config: TrainingConfig;
  private inputShape: number[] = [];
  private scaleParams: { mean: number[]; std: number[] } | null = null;

  constructor(config?: Partial<TrainingConfig>) {
    this.config = {
      sequenceLength: config?.sequenceLength || 60,
      epochs: config?.epochs || 100,
      batchSize: config?.batchSize || 32,
      learningRate: config?.learningRate || 0.001,
      validationSplit: config?.validationSplit || 0.2,
      lstmUnits: config?.lstmUnits || [128, 64, 32],
      dropout: config?.dropout || 0.2,
    };
  }

  /**
   * Prepare data for training
   */
  private prepareData(data: OHLCVData[]): {
    X: number[][][];
    y: number[];
  } {
    // Calculate technical indicators
    const indicators = TechnicalIndicators.calculateAllIndicators(data);

    // Create feature vectors
    const features: number[][] = [];
    const labels: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      const ind = indicators[i];

      // Feature engineering: combine price and indicators
      const featureVector = [
        // Price features (normalized)
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        // Indicator features
        ind.rsi / 100,
        ind.macd.MACD,
        ind.macd.signal,
        ind.macd.histogram,
        ind.bb.upper,
        ind.bb.middle,
        ind.bb.lower,
        ind.ema_fast,
        ind.ema_slow,
        ind.sma,
        ind.stochastic.k / 100,
        ind.stochastic.d / 100,
        ind.atr,
        ind.adx / 100,
      ];

      features.push(featureVector);

      // Label: future price direction (1 = up, 0 = down)
      if (i < data.length - 10) {
        const futurePrice = data[i + 10].close;
        labels.push(futurePrice > bar.close ? 1 : 0);
      }
    }

    // Remove last 10 samples (no labels)
    features.splice(-10);

    // Normalize features
    this.scaleParams = this.calculateScaleParams(features);
    const normalizedFeatures = this.normalizeFeatures(features, this.scaleParams);

    // Create sequences
    const X: number[][][] = [];
    const y: number[] = [];

    for (let i = 0; i <= normalizedFeatures.length - this.config.sequenceLength - 1; i++) {
      X.push(normalizedFeatures.slice(i, i + this.config.sequenceLength));
      y.push(labels[i + this.config.sequenceLength - 1]);
    }

    this.inputShape = [this.config.sequenceLength, features[0].length];

    return { X, y };
  }

  /**
   * Calculate mean and std for normalization
   */
  private calculateScaleParams(features: number[][]): { mean: number[]; std: number[] } {
    const numFeatures = features[0].length;
    const mean: number[] = new Array(numFeatures).fill(0);
    const std: number[] = new Array(numFeatures).fill(0);

    // Calculate mean
    for (const feature of features) {
      for (let j = 0; j < numFeatures; j++) {
        mean[j] += feature[j];
      }
    }
    for (let j = 0; j < numFeatures; j++) {
      mean[j] /= features.length;
    }

    // Calculate std
    for (const feature of features) {
      for (let j = 0; j < numFeatures; j++) {
        std[j] += Math.pow(feature[j] - mean[j], 2);
      }
    }
    for (let j = 0; j < numFeatures; j++) {
      std[j] = Math.sqrt(std[j] / features.length);
      if (std[j] === 0) std[j] = 1; // Prevent division by zero
    }

    return { mean, std };
  }

  /**
   * Normalize features using z-score
   */
  private normalizeFeatures(features: number[][], params: { mean: number[]; std: number[] }): number[][] {
    return features.map((feature) =>
      feature.map((val, idx) => (val - params.mean[idx]) / params.std[idx])
    );
  }

  /**
   * Build LSTM model
   */
  private buildModel(): tf.LayersModel {
    const model = tf.sequential();

    // First LSTM layer
    model.add(
      tf.layers.lstm({
        units: this.config.lstmUnits[0],
        returnSequences: true,
        inputShape: this.inputShape,
      })
    );
    model.add(tf.layers.dropout({ rate: this.config.dropout }));

    // Second LSTM layer
    if (this.config.lstmUnits.length > 1) {
      model.add(
        tf.layers.lstm({
          units: this.config.lstmUnits[1],
          returnSequences: this.config.lstmUnits.length > 2,
        })
      );
      model.add(tf.layers.dropout({ rate: this.config.dropout }));
    }

    // Third LSTM layer (optional)
    if (this.config.lstmUnits.length > 2) {
      model.add(
        tf.layers.lstm({
          units: this.config.lstmUnits[2],
          returnSequences: false,
        })
      );
      model.add(tf.layers.dropout({ rate: this.config.dropout }));
    }

    // Dense layers
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: this.config.dropout }));

    // Output layer (binary classification: up or down)
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Train the model
   */
  async train(data: OHLCVData[], onProgress?: (epoch: number, logs: any) => void): Promise<ModelMetrics> {
    console.log('Preparing training data...');
    const { X, y } = this.prepareData(data);

    console.log(`Training samples: ${X.length}, Input shape: [${this.inputShape}]`);

    // Convert to tensors
    const xTensor = tf.tensor3d(X);
    const yTensor = tf.tensor2d(y, [y.length, 1]);

    // Build model
    console.log('Building LSTM model...');
    this.model = this.buildModel();

    console.log(`Model architecture: ${this.config.lstmUnits.join('-')} LSTM units`);

    // Train model
    console.log('Starting training...');
    const history = await this.model.fit(xTensor, yTensor, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationSplit: this.config.validationSplit,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (onProgress) {
            onProgress(epoch + 1, logs);
          }
          if ((epoch + 1) % 10 === 0) {
            console.log(
              `Epoch ${epoch + 1}/${this.config.epochs} - loss: ${logs?.loss.toFixed(4)}, accuracy: ${logs?.acc.toFixed(4)}, val_loss: ${logs?.val_loss.toFixed(4)}, val_acc: ${logs?.val_acc.toFixed(4)}`
            );
          }
        },
      },
    });

    // Calculate metrics
    const finalEpoch = history.history.acc.length - 1;
    const accuracy = history.history.acc[finalEpoch] as number;
    const valAccuracy = history.history.val_acc?.[finalEpoch] as number || accuracy;
    const loss = history.history.loss[finalEpoch] as number;
    const valLoss = history.history.val_loss?.[finalEpoch] as number || loss;

    // Calculate additional metrics (precision, recall, F1)
    const predictions = await this.model.predict(xTensor) as tf.Tensor;
    const predArray = await predictions.data();
    const yArray = await yTensor.data();

    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < predArray.length; i++) {
      const pred = predArray[i] > 0.5 ? 1 : 0;
      const actual = yArray[i];
      if (pred === 1 && actual === 1) tp++;
      else if (pred === 1 && actual === 0) fp++;
      else if (pred === 0 && actual === 0) tn++;
      else fn++;
    }

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1Score = (2 * precision * recall) / (precision + recall) || 0;
    const winRate = (tp + tn) / predArray.length;

    // Cleanup tensors
    xTensor.dispose();
    yTensor.dispose();
    predictions.dispose();

    const metrics: ModelMetrics = {
      accuracy: valAccuracy,
      precision,
      recall,
      f1Score,
      loss,
      valLoss,
      winRate,
      profitability: this.estimateProfitability(winRate, precision),
    };

    console.log('Training complete!');
    console.log(`Final Metrics: Accuracy=${(metrics.accuracy * 100).toFixed(2)}%, Precision=${(metrics.precision * 100).toFixed(2)}%, Win Rate=${(metrics.winRate * 100).toFixed(2)}%`);

    return metrics;
  }

  /**
   * Estimate profitability based on win rate and precision
   */
  private estimateProfitability(winRate: number, precision: number): number {
    // Assume risk-reward ratio of 1:2
    const avgWin = 2.0;
    const avgLoss = 1.0;
    const profitability = (winRate * avgWin - (1 - winRate) * avgLoss) * precision;
    return Math.max(0, Math.min(1, profitability));
  }

  /**
   * Make prediction
   */
  async predict(recentData: OHLCVData[]): Promise<PredictionResult> {
    if (!this.model || !this.scaleParams) {
      throw new Error('Model not trained yet');
    }

    if (recentData.length < this.config.sequenceLength) {
      throw new Error(`Need at least ${this.config.sequenceLength} bars for prediction`);
    }

    // Prepare input sequence
    const indicators = TechnicalIndicators.calculateAllIndicators(recentData);
    const features: number[][] = [];

    for (let i = 0; i < recentData.length; i++) {
      const bar = recentData[i];
      const ind = indicators[i];

      features.push([
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        ind.rsi / 100,
        ind.macd.MACD,
        ind.macd.signal,
        ind.macd.histogram,
        ind.bb.upper,
        ind.bb.middle,
        ind.bb.lower,
        ind.ema_fast,
        ind.ema_slow,
        ind.sma,
        ind.stochastic.k / 100,
        ind.stochastic.d / 100,
        ind.atr,
        ind.adx / 100,
      ]);
    }

    // Normalize
    const normalizedFeatures = this.normalizeFeatures(features, this.scaleParams);
    const sequence = normalizedFeatures.slice(-this.config.sequenceLength);

    // Predict
    const inputTensor = tf.tensor3d([sequence]);
    const prediction = (await this.model.predict(inputTensor)) as tf.Tensor;
    const confidence = (await prediction.data())[0];

    inputTensor.dispose();
    prediction.dispose();

    // Generate trading signal
    const currentPrice = recentData[recentData.length - 1].close;
    const atr = indicators[indicators.length - 1].atr;

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let predictedPrice = currentPrice;
    let stopLoss = currentPrice;
    let takeProfit = currentPrice;

    if (confidence > 0.6) {
      signal = 'BUY';
      predictedPrice = currentPrice * (1 + 0.01); // Expect 1% move
      stopLoss = currentPrice - atr * 2;
      takeProfit = currentPrice + atr * 4;
    } else if (confidence < 0.4) {
      signal = 'SELL';
      predictedPrice = currentPrice * (1 - 0.01);
      stopLoss = currentPrice + atr * 2;
      takeProfit = currentPrice - atr * 4;
    }

    const expectedReturn = ((predictedPrice - currentPrice) / currentPrice) * 100;

    return {
      signal,
      confidence: Math.abs(confidence - 0.5) * 2, // Convert to 0-1 range
      predictedPrice,
      expectedReturn,
      stopLoss,
      takeProfit,
    };
  }

  /**
   * Save model to file
   */
  async save(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }
    await this.model.save(`file://${path}`);
    console.log(`Model saved to ${path}`);
  }

  /**
   * Load model from file
   */
  async load(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    console.log(`Model loaded from ${path}`);
  }
}