"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  TrendingDown,
  ZapOff,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface RiskData {
  id: number;
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

const RiskMonitor = () => {
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [risk, openPositions] = await Promise.all([
        apiFetch<RiskData>("/api/risk"),
        apiFetch<Position[]>("/api/positions?status=open&limit=10")
      ]);
      
      setRiskData(risk);
      setPositions(openPositions);
    } catch (error) {
      console.error("Failed to load risk data:", error);
      toast.error("Failed to load risk data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleReduceRisk = useCallback(async () => {
    if (!riskData) return;
    
    setBusy(true);
    try {
      const newRiskPerTrade = Math.max(0.5, riskData.maxRiskPerTradePct - 0.5);
      
      await apiFetch("/api/risk", {
        method: "PATCH",
        body: {
          maxRiskPerTradePct: newRiskPerTrade
        }
      });
      
      toast.success(`Risk reduced to ${newRiskPerTrade}% per trade`);
      await loadData();
    } catch (error) {
      toast.error("Failed to reduce risk");
    } finally {
      setBusy(false);
    }
  }, [riskData, loadData]);

  const handleEmergencyStop = useCallback(async () => {
    setBusy(true);
    try {
      await apiFetch("/api/system/toggle", {
        method: "POST",
        body: {
          aiActive: false,
          riskMonitorActive: true
        }
      });
      
      toast.success("Emergency stop activated - AI disabled");
    } catch (error) {
      toast.error("Failed to activate emergency stop");
    } finally {
      setBusy(false);
    }
  }, []);

  if (loading) {
    return (
      <Card className="bg-background-secondary border-border-color h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!riskData) {
    return (
      <Card className="bg-background-secondary border-border-color h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Risk data unavailable</p>
      </Card>
    );
  }

  const totalPnL = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const dailyLossPct = Math.abs(totalPnL / riskData.maxDailyLoss) * 100;
  const currentDrawdown = Math.abs(Math.min(0, totalPnL));
  const drawdownPct = (currentDrawdown / (riskData.maxDailyLoss * 5)) * 100;
  const positionSize = positions.length > 0 ? positions[0].volume : 0.1;
  
  const riskLevel = drawdownPct > 80 || dailyLossPct > 80 ? "HIGH" : 
                   drawdownPct > 50 || dailyLossPct > 50 ? "MEDIUM" : "LOW";
  
  const riskBadgeColor = riskLevel === "HIGH" ? "bg-warning-red text-white" :
                        riskLevel === "MEDIUM" ? "bg-gold-secondary text-background-primary" :
                        "bg-gold-primary text-background-primary";

  return (
    <Card className="bg-background-secondary border-border-color h-full flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">
              Risk Monitor
            </CardTitle>
            <p className="text-xs text-text-muted">
              {riskData.capitalProtectionEnabled ? "Capital Protection Enabled" : "Capital Protection Disabled"}
            </p>
          </div>
        </div>
        <Badge className={`${riskBadgeColor} hover:${riskBadgeColor} font-bold`}>
          {riskLevel}
        </Badge>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between space-y-6">
        <div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-text-secondary">
                Current Drawdown
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {drawdownPct.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(drawdownPct, 100)}
              className="h-2 bg-background-tertiary [&>div]:bg-gold-primary"
            />
            <div className="text-right text-xs text-text-muted mt-1">
              Max: {riskData.maxDrawdownPct}%
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-text-secondary">Daily Loss</span>
            <span className={`text-sm font-semibold ${totalPnL < 0 ? 'text-warning-red' : 'text-success-green'}`}>
              ${totalPnL.toFixed(2)}
            </span>
          </div>
          <Progress
            value={Math.min(dailyLossPct, 100)}
            className="h-2 bg-background-tertiary [&>div]:bg-gold-primary"
          />
          <div className="text-right text-xs text-text-muted mt-1">
            Limit: ${riskData.maxDailyLoss.toFixed(2)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border border-border-color p-3">
            <p className="text-xs text-text-muted">Position Size</p>
            <p className="text-base font-semibold text-text-primary">
              {positionSize.toFixed(2)} lots
            </p>
          </div>
          <div className="rounded-md border border-border-color p-3">
            <p className="text-xs text-text-muted">Risk/Trade</p>
            <p className="text-base font-semibold text-text-primary">
              {riskData.maxRiskPerTradePct.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="border-border-color text-text-secondary hover:bg-background-tertiary hover:text-text-primary"
            onClick={handleReduceRisk}
            disabled={busy}
          >
            <TrendingDown className="mr-2 h-4 w-4" />
            Reduce Risk
          </Button>
          <Button
            variant="destructive"
            className="bg-warning-red text-white hover:bg-warning-red/90"
            onClick={handleEmergencyStop}
            disabled={busy}
          >
            <ZapOff className="mr-2 h-4 w-4" />
            Emergency Stop
          </Button>
        </div>

        <div className="rounded-lg bg-success-green/10 p-4 border border-success-green/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-success-green"></div>
            <p className="font-semibold text-sm text-text-primary">
              Capital Protection Active
            </p>
          </div>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success-green flex-shrink-0" />
              <span>Real-time position sizing enabled</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success-green flex-shrink-0" />
              <span>Daily loss limits enforced</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success-green flex-shrink-0" />
              <span>Drawdown monitoring active</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default RiskMonitor;