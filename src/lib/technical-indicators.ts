/**
 * Real Technical Indicators Library
 * Using technicalindicators package for production-grade calculations
 */

import {
  RSI,
  MACD,
  BollingerBands,
  EMA,
  SMA,
  Stochastic,
  ATR,
  ADX,
} from 'technicalindicators';

export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValues {
  rsi: number;
  macd: { MACD: number; signal: number; histogram: number };
  bb: { upper: number; middle: number; lower: number };
  ema_fast: number;
  ema_slow: number;
  sma: number;
  stochastic: { k: number; d: number };
  atr: number;
  adx: number;
}

export class TechnicalIndicators {
  /**
   * Calculate RSI (Relative Strength Index)
   */
  static calculateRSI(closes: number[], period: number = 14): number[] {
    const rsi = new RSI({ values: closes, period });
    return rsi.getResult();
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(
    closes: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): Array<{ MACD: number; signal: number; histogram: number }> {
    const macd = new MACD({
      values: closes,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    return macd.getResult();
  }

  /**
   * Calculate Bollinger Bands
   */
  static calculateBollingerBands(
    closes: number[],
    period: number = 20,
    stdDev: number = 2
  ): Array<{ upper: number; middle: number; lower: number }> {
    const bb = new BollingerBands({
      values: closes,
      period,
      stdDev,
    });
    return bb.getResult();
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  static calculateEMA(closes: number[], period: number = 20): number[] {
    const ema = new EMA({ values: closes, period });
    return ema.getResult();
  }

  /**
   * Calculate SMA (Simple Moving Average)
   */
  static calculateSMA(closes: number[], period: number = 20): number[] {
    const sma = new SMA({ values: closes, period });
    return sma.getResult();
  }

  /**
   * Calculate Stochastic Oscillator
   */
  static calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
    signalPeriod: number = 3
  ): Array<{ k: number; d: number }> {
    const stoch = new Stochastic({
      high: highs,
      low: lows,
      close: closes,
      period,
      signalPeriod,
    });
    return stoch.getResult();
  }

  /**
   * Calculate ATR (Average True Range)
   */
  static calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number[] {
    const atr = new ATR({
      high: highs,
      low: lows,
      close: closes,
      period,
    });
    return atr.getResult();
  }

  /**
   * Calculate ADX (Average Directional Index)
   */
  static calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): Array<{ adx: number; pdi: number; mdi: number }> {
    const adx = new ADX({
      high: highs,
      low: lows,
      close: closes,
      period,
    });
    return adx.getResult();
  }

  /**
   * Calculate all indicators for a dataset
   */
  static calculateAllIndicators(data: OHLCVData[]): IndicatorValues[] {
    if (data.length < 50) {
      throw new Error('Insufficient data for indicator calculation (need at least 50 bars)');
    }

    const closes = data.map((d) => d.close);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const opens = data.map((d) => d.open);

    // Calculate all indicators
    const rsi = this.calculateRSI(closes);
    const macd = this.calculateMACD(closes);
    const bb = this.calculateBollingerBands(closes);
    const ema_fast = this.calculateEMA(closes, 12);
    const ema_slow = this.calculateEMA(closes, 26);
    const sma = this.calculateSMA(closes, 20);
    const stochastic = this.calculateStochastic(highs, lows, closes);
    const atr = this.calculateATR(highs, lows, closes);
    const adx = this.calculateADX(highs, lows, closes);

    // Combine all indicators with proper alignment
    const results: IndicatorValues[] = [];

    for (let i = 0; i < data.length; i++) {
      results.push({
        rsi: rsi[i] || 50,
        macd: macd[i] || { MACD: 0, signal: 0, histogram: 0 },
        bb: bb[i] || { upper: closes[i], middle: closes[i], lower: closes[i] },
        ema_fast: ema_fast[i] || closes[i],
        ema_slow: ema_slow[i] || closes[i],
        sma: sma[i] || closes[i],
        stochastic: stochastic[i] || { k: 50, d: 50 },
        atr: atr[i] || 0,
        adx: adx[i]?.adx || 0,
      });
    }

    return results;
  }

  /**
   * Generate trading signals based on indicators
   */
  static generateSignals(
    data: OHLCVData[],
    indicators: IndicatorValues[]
  ): Array<{ signal: 'BUY' | 'SELL' | 'HOLD'; strength: number; reasons: string[] }> {
    const signals: Array<{ signal: 'BUY' | 'SELL' | 'HOLD'; strength: number; reasons: string[] }> = [];

    for (let i = 1; i < indicators.length; i++) {
      const current = indicators[i];
      const previous = indicators[i - 1];
      const price = data[i].close;

      let buyScore = 0;
      let sellScore = 0;
      const reasons: string[] = [];

      // RSI Signals
      if (current.rsi < 30) {
        buyScore += 2;
        reasons.push('RSI oversold (<30)');
      } else if (current.rsi > 70) {
        sellScore += 2;
        reasons.push('RSI overbought (>70)');
      }

      // MACD Signals
      if (current.macd.MACD > current.macd.signal && previous.macd.MACD <= previous.macd.signal) {
        buyScore += 2;
        reasons.push('MACD bullish crossover');
      } else if (current.macd.MACD < current.macd.signal && previous.macd.MACD >= previous.macd.signal) {
        sellScore += 2;
        reasons.push('MACD bearish crossover');
      }

      // Bollinger Bands Signals
      if (price < current.bb.lower) {
        buyScore += 1;
        reasons.push('Price below lower BB');
      } else if (price > current.bb.upper) {
        sellScore += 1;
        reasons.push('Price above upper BB');
      }

      // EMA Crossover Signals
      if (current.ema_fast > current.ema_slow && previous.ema_fast <= previous.ema_slow) {
        buyScore += 2;
        reasons.push('EMA bullish crossover');
      } else if (current.ema_fast < current.ema_slow && previous.ema_fast >= previous.ema_slow) {
        sellScore += 2;
        reasons.push('EMA bearish crossover');
      }

      // Stochastic Signals
      if (current.stochastic.k < 20 && current.stochastic.d < 20) {
        buyScore += 1;
        reasons.push('Stochastic oversold');
      } else if (current.stochastic.k > 80 && current.stochastic.d > 80) {
        sellScore += 1;
        reasons.push('Stochastic overbought');
      }

      // ADX Trend Strength
      if (current.adx > 25) {
        // Strong trend - amplify signals
        buyScore *= 1.2;
        sellScore *= 1.2;
      }

      // Determine signal
      const totalScore = Math.max(buyScore, sellScore);
      const strength = Math.min(totalScore / 10, 1); // Normalize to 0-1

      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (buyScore > sellScore && buyScore >= 3) {
        signal = 'BUY';
      } else if (sellScore > buyScore && sellScore >= 3) {
        signal = 'SELL';
      }

      signals.push({ signal, strength, reasons });
    }

    return signals;
  }
}