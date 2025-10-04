/**
 * Real Backtesting Engine
 * Walk-forward analysis and strategy validation
 */

import { OHLCVData, TechnicalIndicators } from './technical-indicators';

export interface BacktestConfig {
  initialCapital: number;
  riskPerTrade: number; // Percentage of capital
  commission: number; // Per trade
  slippage: number; // Points
  maxPositions: number;
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  size: number;
  profit: number;
  profitPercentage: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
}

export interface BacktestResults {
  trades: Trade[];
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  netProfitPercentage: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageTradeDuration: number;
  finalCapital: number;
}

export type SignalGenerator = (
  data: OHLCVData[],
  index: number
) => { signal: 'BUY' | 'SELL' | 'HOLD'; stopLoss: number; takeProfit: number } | null;

export class Backtester {
  private config: BacktestConfig;
  private capital: number;
  private openPositions: Array<{
    type: 'BUY' | 'SELL';
    entryPrice: number;
    entryTime: number;
    size: number;
    stopLoss: number;
    takeProfit: number;
  }> = [];
  private closedTrades: Trade[] = [];
  private equityCurve: number[] = [];

  constructor(config: BacktestConfig) {
    this.config = config;
    this.capital = config.initialCapital;
  }

  /**
   * Run backtest on historical data
   */
  run(data: OHLCVData[], signalGenerator: SignalGenerator): BacktestResults {
    console.log(`Starting backtest with ${data.length} bars...`);

    this.capital = this.config.initialCapital;
    this.openPositions = [];
    this.closedTrades = [];
    this.equityCurve = [this.capital];

    // Walk through historical data
    for (let i = 100; i < data.length; i++) {
      const currentBar = data[i];

      // Check and close existing positions
      this.checkExitConditions(currentBar, i);

      // Generate new signals
      if (this.openPositions.length < this.config.maxPositions) {
        const signal = signalGenerator(data.slice(0, i + 1), i);

        if (signal && signal.signal !== 'HOLD') {
          this.openPosition(signal.signal, currentBar, signal.stopLoss, signal.takeProfit, i);
        }
      }

      // Update equity curve
      const currentEquity = this.calculateCurrentEquity(currentBar);
      this.equityCurve.push(currentEquity);
    }

    // Close any remaining positions at the end
    if (this.openPositions.length > 0) {
      const lastBar = data[data.length - 1];
      this.closeAllPositions(lastBar, data.length - 1, 'End of backtest');
    }

    return this.calculateResults();
  }

  /**
   * Open a new position
   */
  private openPosition(
    type: 'BUY' | 'SELL',
    bar: OHLCVData,
    stopLoss: number,
    takeProfit: number,
    index: number
  ): void {
    const entryPrice = bar.close + (type === 'BUY' ? this.config.slippage : -this.config.slippage);

    // Calculate position size based on risk
    const riskAmount = this.capital * this.config.riskPerTrade;
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const size = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;

    if (size === 0) {
      return;
    }

    // Apply commission
    this.capital -= this.config.commission;

    this.openPositions.push({
      type,
      entryPrice,
      entryTime: bar.time,
      size,
      stopLoss,
      takeProfit,
    });

    console.log(
      `Opened ${type} position at ${entryPrice.toFixed(2)}, SL: ${stopLoss.toFixed(2)}, TP: ${takeProfit.toFixed(2)}`
    );
  }

  /**
   * Check exit conditions for open positions
   */
  private checkExitConditions(bar: OHLCVData, index: number): void {
    const positionsToClose: number[] = [];

    for (let i = 0; i < this.openPositions.length; i++) {
      const position = this.openPositions[i];

      let exitPrice: number | null = null;
      let reason = '';

      if (position.type === 'BUY') {
        // Check stop loss
        if (bar.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          reason = 'Stop Loss';
        }
        // Check take profit
        else if (bar.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          reason = 'Take Profit';
        }
      } else {
        // SELL position
        // Check stop loss
        if (bar.high >= position.stopLoss) {
          exitPrice = position.stopLoss;
          reason = 'Stop Loss';
        }
        // Check take profit
        else if (bar.low <= position.takeProfit) {
          exitPrice = position.takeProfit;
          reason = 'Take Profit';
        }
      }

      if (exitPrice !== null) {
        this.closePosition(i, exitPrice, bar.time, reason);
        positionsToClose.push(i);
      }
    }

    // Remove closed positions (in reverse order to maintain indices)
    for (let i = positionsToClose.length - 1; i >= 0; i--) {
      this.openPositions.splice(positionsToClose[i], 1);
    }
  }

  /**
   * Close a position
   */
  private closePosition(index: number, exitPrice: number, exitTime: number, reason: string): void {
    const position = this.openPositions[index];

    // Apply commission
    this.capital -= this.config.commission;

    // Calculate profit
    let profit: number;
    if (position.type === 'BUY') {
      profit = (exitPrice - position.entryPrice) * position.size;
    } else {
      profit = (position.entryPrice - exitPrice) * position.size;
    }

    this.capital += profit;

    const profitPercentage = (profit / (position.entryPrice * position.size)) * 100;

    const trade: Trade = {
      entryTime: position.entryTime,
      exitTime,
      type: position.type,
      entryPrice: position.entryPrice,
      exitPrice,
      size: position.size,
      profit,
      profitPercentage,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      reason,
    };

    this.closedTrades.push(trade);

    console.log(
      `Closed ${position.type} position at ${exitPrice.toFixed(2)}, Profit: $${profit.toFixed(2)} (${profitPercentage.toFixed(2)}%), Reason: ${reason}`
    );
  }

  /**
   * Close all open positions
   */
  private closeAllPositions(bar: OHLCVData, index: number, reason: string): void {
    while (this.openPositions.length > 0) {
      this.closePosition(0, bar.close, bar.time, reason);
      this.openPositions.splice(0, 1);
    }
  }

  /**
   * Calculate current equity including open positions
   */
  private calculateCurrentEquity(bar: OHLCVData): number {
    let equity = this.capital;

    for (const position of this.openPositions) {
      let unrealizedPnL: number;
      if (position.type === 'BUY') {
        unrealizedPnL = (bar.close - position.entryPrice) * position.size;
      } else {
        unrealizedPnL = (position.entryPrice - bar.close) * position.size;
      }
      equity += unrealizedPnL;
    }

    return equity;
  }

  /**
   * Calculate backtest results
   */
  private calculateResults(): BacktestResults {
    const winningTrades = this.closedTrades.filter((t) => t.profit > 0);
    const losingTrades = this.closedTrades.filter((t) => t.profit <= 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const netProfit = totalProfit - totalLoss;

    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    const averageWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.profit)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.abs(Math.min(...losingTrades.map((t) => t.profit))) : 0;

    // Calculate Sharpe Ratio
    const returns = this.closedTrades.map((t) => t.profitPercentage);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length || 0;
    const stdDev =
      Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) || 1;
    const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252); // Annualized

    // Calculate max drawdown
    let maxDrawdown = 0;
    let maxDrawdownPercentage = 0;
    let peak = this.config.initialCapital;

    for (const equity of this.equityCurve) {
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = peak - equity;
      const drawdownPercentage = (drawdown / peak) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercentage = drawdownPercentage;
      }
    }

    // Calculate average trade duration
    const totalDuration = this.closedTrades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0);
    const averageTradeDuration = this.closedTrades.length > 0 ? totalDuration / this.closedTrades.length : 0;

    return {
      trades: this.closedTrades,
      totalTrades: this.closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: this.closedTrades.length > 0 ? (winningTrades.length / this.closedTrades.length) * 100 : 0,
      totalProfit,
      totalLoss,
      netProfit,
      netProfitPercentage: (netProfit / this.config.initialCapital) * 100,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercentage,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      averageTradeDuration,
      finalCapital: this.capital,
    };
  }
}