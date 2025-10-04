"use client";

import { useState, useEffect } from "react";
import { Shield, AlertTriangle, TrendingDown, Activity, DollarSign, Target } from "lucide-react";
import { toast } from "sonner";

interface RiskLimits {
  maxDailyLoss: number;
  maxDrawdownPct: number;
  maxRiskPerTradePct: number;
  maxConcurrentPositions: number;
  capitalProtectionEnabled: boolean;
}

interface Position {
  id: number;
  symbol: string;
  side: string;
  volume: number;
  entryPrice: number;
  pnl: number | null;
  status: string;
}

interface Account {
  balance: number;
  equity: number;
  marginLevel: number | null;
}

export function RiskManagementTab() {
  const [riskLimits, setRiskLimits] = useState<RiskLimits>({
    maxDailyLoss: 500,
    maxDrawdownPct: 10,
    maxRiskPerTradePct: 2,
    maxConcurrentPositions: 3,
    capitalProtectionEnabled: true,
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyPnL, setDailyPnL] = useState(0);

  const loadData = async () => {
    try {
      setError(null);
      // Load positions
      const posRes = await fetch("/api/positions");
      const posData = await posRes.json();
      if (posData.success) {
        setPositions(posData.positions || []);
        
        // Calculate daily PnL
        const openPositions = (posData.positions || []).filter((p: Position) => p.status === "open");
        const totalPnL = openPositions.reduce((sum: number, p: Position) => sum + (p.pnl || 0), 0);
        setDailyPnL(totalPnL);
      } else {
        throw new Error(posData.error || "Failed to load positions");
      }

      // Load account
      const accRes = await fetch("/api/accounts");
      const accData = await accRes.json();
      if (accData.success && accData.accounts?.length > 0) {
        setAccount(accData.accounts[0]);
      }

      // Load risk limits
      const riskRes = await fetch("/api/risk");
      const riskData = await riskRes.json();
      if (riskData.success && riskData.limits) {
        setRiskLimits(riskData.limits);
      }
    } catch (error) {
      console.error("Failed to load risk data:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to load risk data";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const drawdown = account ? ((account.balance - account.equity) / account.balance) * 100 : 0;
  const dailyLossPercent = account ? (dailyPnL / account.balance) * 100 : 0;
  const openPositionsCount = positions.filter(p => p.status === "open").length;

  const getRiskLevel = () => {
    if (Math.abs(dailyLossPercent) >= riskLimits.maxRiskPerTradePct * 2) return { color: "text-warning-red", label: "HIGH RISK", bg: "bg-warning-red/10" };
    if (Math.abs(dailyLossPercent) >= riskLimits.maxRiskPerTradePct) return { color: "text-gold-primary", label: "MODERATE", bg: "bg-gold-primary/10" };
    return { color: "text-success-green", label: "LOW RISK", bg: "bg-success-green/10" };
  };

  const riskLevel = getRiskLevel();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="bg-warning-red/10 border border-warning-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning-red flex-shrink-0" />
          <p className="text-sm text-warning-red">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-success-green" />
          <h2 className="text-xl font-bold text-text-primary">Risk Management</h2>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${riskLevel.bg}`}>
          <Activity className={`w-4 h-4 ${riskLevel.color}`} />
          <span className={`text-sm font-semibold ${riskLevel.color}`}>{riskLevel.label}</span>
        </div>
      </div>

      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-background-secondary rounded-lg border border-border-color p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Daily P&L</span>
            <DollarSign className={`w-4 h-4 ${dailyPnL >= 0 ? 'text-success-green' : 'text-warning-red'}`} />
          </div>
          <p className={`text-2xl font-bold ${dailyPnL >= 0 ? 'text-success-green' : 'text-warning-red'}`}>
            ${dailyPnL.toFixed(2)}
          </p>
          <p className="text-xs text-text-muted mt-1">{dailyLossPercent.toFixed(2)}% of balance</p>
          <div className="mt-2 h-1.5 bg-background-tertiary rounded-full overflow-hidden">
            <div 
              className={`h-full ${Math.abs(dailyLossPercent) >= riskLimits.maxRiskPerTradePct * 2 ? 'bg-warning-red' : 'bg-success-green'}`}
              style={{ width: `${Math.min(Math.abs(dailyLossPercent) / riskLimits.maxDailyLoss * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-background-secondary rounded-lg border border-border-color p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Drawdown</span>
            <TrendingDown className={`w-4 h-4 ${drawdown > riskLimits.maxDrawdownPct ? 'text-warning-red' : 'text-gold-primary'}`} />
          </div>
          <p className={`text-2xl font-bold ${drawdown > riskLimits.maxDrawdownPct ? 'text-warning-red' : 'text-text-primary'}`}>
            {drawdown.toFixed(2)}%
          </p>
          <p className="text-xs text-text-muted mt-1">Max: {riskLimits.maxDrawdownPct}%</p>
          <div className="mt-2 h-1.5 bg-background-tertiary rounded-full overflow-hidden">
            <div 
              className={`h-full ${drawdown > riskLimits.maxDrawdownPct ? 'bg-warning-red' : 'bg-gold-primary'}`}
              style={{ width: `${Math.min((drawdown / riskLimits.maxDrawdownPct) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-background-secondary rounded-lg border border-border-color p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Open Positions</span>
            <Target className={`w-4 h-4 ${openPositionsCount >= riskLimits.maxConcurrentPositions ? 'text-warning-red' : 'text-success-green'}`} />
          </div>
          <p className={`text-2xl font-bold ${openPositionsCount >= riskLimits.maxConcurrentPositions ? 'text-warning-red' : 'text-text-primary'}`}>
            {openPositionsCount}
          </p>
          <p className="text-xs text-text-muted mt-1">Max: {riskLimits.maxConcurrentPositions}</p>
          <div className="mt-2 h-1.5 bg-background-tertiary rounded-full overflow-hidden">
            <div 
              className={`h-full ${openPositionsCount >= riskLimits.maxConcurrentPositions ? 'bg-warning-red' : 'bg-success-green'}`}
              style={{ width: `${(openPositionsCount / riskLimits.maxConcurrentPositions) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-background-secondary rounded-lg border border-border-color p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Margin Level</span>
            <Shield className={`w-4 h-4 ${(account?.marginLevel || 0) < 200 ? 'text-warning-red' : 'text-success-green'}`} />
          </div>
          <p className={`text-2xl font-bold ${(account?.marginLevel || 0) < 200 ? 'text-warning-red' : 'text-text-primary'}`}>
            {account?.marginLevel?.toFixed(0) || 'N/A'}%
          </p>
          <p className="text-xs text-text-muted mt-1">Min safe: 200%</p>
          <div className="mt-2 h-1.5 bg-background-tertiary rounded-full overflow-hidden">
            <div 
              className={`h-full ${(account?.marginLevel || 0) < 200 ? 'bg-warning-red' : 'bg-success-green'}`}
              style={{ width: `${Math.min(((account?.marginLevel || 0) / 500) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Risk Warnings */}
      {(Math.abs(dailyLossPercent) >= riskLimits.maxRiskPerTradePct * 2 || 
        drawdown > riskLimits.maxDrawdownPct || 
        openPositionsCount >= riskLimits.maxConcurrentPositions) && (
        <div className="bg-warning-red/10 border border-warning-red/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-red flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning-red mb-1">Risk Limits Exceeded</h3>
              <ul className="text-sm text-text-secondary space-y-1">
                {Math.abs(dailyLossPercent) >= riskLimits.maxRiskPerTradePct * 2 && (
                  <li>• Daily loss exceeds maximum threshold</li>
                )}
                {drawdown > riskLimits.maxDrawdownPct && (
                  <li>• Drawdown exceeds maximum allowed percentage</li>
                )}
                {openPositionsCount >= riskLimits.maxConcurrentPositions && (
                  <li>• Maximum concurrent positions reached</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Active Positions */}
      <div className="bg-background-secondary rounded-lg border border-border-color">
        <div className="p-4 border-b border-border-color">
          <h3 className="text-base font-semibold text-text-primary">Active Positions</h3>
        </div>
        <div className="p-4">
          {positions.filter(p => p.status === "open").length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No active positions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {positions.filter(p => p.status === "open").map((pos) => (
                <div key={pos.id} className="flex items-center justify-between bg-background-tertiary rounded p-3 border border-border-color">
                  <div>
                    <span className="font-semibold text-text-primary">{pos.symbol}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${pos.side === 'buy' ? 'bg-success-green/20 text-success-green' : 'bg-warning-red/20 text-warning-red'}`}>
                      {pos.side.toUpperCase()}
                    </span>
                    <p className="text-sm text-text-muted mt-1">
                      {pos.volume} lots @ ${pos.entryPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${(pos.pnl || 0) >= 0 ? 'text-success-green' : 'text-warning-red'}`}>
                      ${(pos.pnl || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">P&L</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}