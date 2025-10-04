"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  DollarSign, 
  TrendingDown,
  Calculator,
  AlertTriangle,
  RefreshCw,
  Loader2,
  PieChart,
  Target
} from "lucide-react";
import { toast } from "sonner";
import { PortfolioDiversification } from "@/components/sections/portfolio-diversification";

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

interface DrawdownData {
  timestamp: number;
  equityPeak: number;
  currentEquity: number;
  drawdownPct: number;
  drawdownAmount: number;
  recovered: boolean;
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
  const [drawdownHistory, setDrawdownHistory] = useState<DrawdownData[]>([]);
  const [positionSize, setPositionSize] = useState({ accountSize: 10000, riskPercent: 2, stopLoss: 50 });
  const [calculatedSize, setCalculatedSize] = useState(0);

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

      // Load drawdown history
      const drawdownRes = await fetch("/api/drawdown-history?limit=30&sort=timestamp&order=desc");
      const drawdownData = await drawdownRes.json();
      setDrawdownHistory(drawdownData || []);
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

  // Calculate position size
  const calculatePositionSize = () => {
    const riskAmount = (positionSize.accountSize * positionSize.riskPercent) / 100;
    const size = riskAmount / positionSize.stopLoss;
    setCalculatedSize(size);
  };

  useEffect(() => {
    calculatePositionSize();
  }, [positionSize]);

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
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Portfolio Diversification */}
      <PortfolioDiversification />
      
      {/* Risk Calculator */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Position Size Calculator</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="accountSize">Account Size ($)</Label>
              <Input
                id="accountSize"
                type="number"
                value={positionSize.accountSize}
                onChange={(e) => setPositionSize({...positionSize, accountSize: parseFloat(e.target.value) || 0})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="riskPercent">Risk Per Trade (%)</Label>
              <Input
                id="riskPercent"
                type="number"
                step="0.1"
                value={positionSize.riskPercent}
                onChange={(e) => setPositionSize({...positionSize, riskPercent: parseFloat(e.target.value) || 0})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="stopLoss">Stop Loss (pips)</Label>
              <Input
                id="stopLoss"
                type="number"
                value={positionSize.stopLoss}
                onChange={(e) => setPositionSize({...positionSize, stopLoss: parseFloat(e.target.value) || 0})}
                className="mt-1"
              />
            </div>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Recommended Position Size</p>
            <p className="text-3xl font-bold text-primary">{calculatedSize.toFixed(2)} lots</p>
            <p className="text-xs text-muted-foreground mt-2">
              Risk Amount: ${((positionSize.accountSize * positionSize.riskPercent) / 100).toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Drawdown Monitor */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-warning-red" />
            <CardTitle>Drawdown Monitor</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {drawdownHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No drawdown history available</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-background-tertiary rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Peak Equity</p>
                  <p className="text-xl font-bold text-success-green">
                    ${drawdownHistory[0]?.equityPeak.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background-tertiary rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Current Equity</p>
                  <p className="text-xl font-bold text-foreground">
                    ${drawdownHistory[0]?.currentEquity.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background-tertiary rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Current Drawdown</p>
                  <p className={`text-xl font-bold ${drawdownHistory[0]?.drawdownPct > 5 ? 'text-warning-red' : 'text-gold-primary'}`}>
                    {drawdownHistory[0]?.drawdownPct.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {drawdownHistory.slice(0, 10).map((dd) => (
                  <div key={dd.timestamp} className="flex items-center justify-between bg-background-tertiary rounded p-3 border border-border">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(dd.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Equity: ${dd.currentEquity.toFixed(2)} / Peak: ${dd.equityPeak.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${dd.drawdownPct > 5 ? 'text-warning-red' : 'text-gold-primary'}`}>
                        {dd.drawdownPct.toFixed(2)}%
                      </p>
                      {dd.recovered && (
                        <span className="text-xs text-success-green">✓ Recovered</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Risk Analysis */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-accent-purple" />
            <CardTitle>Portfolio Risk Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Exposure per Symbol</span>
            </div>
            {positions.filter(p => p.status === "open").length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No open positions</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  positions
                    .filter(p => p.status === "open")
                    .reduce((acc, p) => {
                      acc[p.symbol] = (acc[p.symbol] || 0) + p.volume;
                      return acc;
                    }, {} as Record<string, number>)
                ).map(([symbol, volume]) => (
                  <div key={symbol} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground w-24">{symbol}</span>
                    <div className="flex-1 h-6 bg-background-tertiary rounded-full overflow-hidden border border-border">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${(volume / positions.reduce((sum, p) => sum + p.volume, 0)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-16 text-right">{volume.toFixed(2)} lots</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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