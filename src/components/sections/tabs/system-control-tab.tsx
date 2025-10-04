"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Power, Settings, RefreshCw, AlertTriangle, Clock, DollarSign, TrendingUp, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface SystemStatus {
  isActive: boolean;
  lastUpdate: string;
  activeTrades: number;
  totalProfit: number;
  health: string;
}

interface AutoTradingConfig {
  id: string;
  enabled: boolean;
  maxDailyLoss: number;
  maxDailyTrades: number;
  maxPositionSize: number;
  minConfidence: number;
  tradingHours: string;
  enabledSymbols: string[];
  emergencyStopEnabled: boolean;
  currentDailyLoss: number;
  currentDailyTrades: number;
  createdAt: string;
  updatedAt: string;
}

export default function SystemControlTab() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isActive: false,
    lastUpdate: new Date().toISOString(),
    activeTrades: 0,
    totalProfit: 0,
    health: "good",
  });

  const [autoConfig, setAutoConfig] = useState<AutoTradingConfig>({
    id: "",
    enabled: false,
    maxDailyLoss: 500,
    maxDailyTrades: 10,
    maxPositionSize: 1.0,
    minConfidence: 0.7,
    tradingHours: "00:00-23:59",
    enabledSymbols: ["XAUUSD"],
    emergencyStopEnabled: true,
    currentDailyLoss: 0,
    currentDailyTrades: 0,
    createdAt: "",
    updatedAt: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSystemStatus();
    fetchAutoTradingConfig();
    const interval = setInterval(fetchSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch("/api/system/status");
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch system status:", error);
    }
  };

  const fetchAutoTradingConfig = async () => {
    try {
      const response = await fetch("/api/auto-trading-config");
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setAutoConfig(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch auto-trading config:", error);
    }
  };

  const toggleSystem = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/system/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !systemStatus.isActive }),
      });

      if (response.ok) {
        toast.success(systemStatus.isActive ? "System stopped" : "System started");
        await fetchSystemStatus();
      } else {
        toast.error("Failed to toggle system");
      }
    } catch (error) {
      toast.error("Failed to toggle system");
    }
    setLoading(false);
  };

  const updateAutoTradingConfig = async () => {
    setLoading(true);
    try {
      const method = autoConfig.id ? "PUT" : "POST";
      const response = await fetch("/api/auto-trading-config", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(autoConfig),
      });

      if (response.ok) {
        toast.success("Auto-trading configuration updated");
        await fetchAutoTradingConfig();
      } else {
        toast.error("Failed to update configuration");
      }
    } catch (error) {
      toast.error("Failed to update configuration");
    }
    setLoading(false);
  };

  const emergencyStop = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/system/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false, emergency: true }),
      });

      if (response.ok) {
        toast.success("Emergency stop activated!");
        await fetchSystemStatus();
        setAutoConfig({ ...autoConfig, enabled: false });
      } else {
        toast.error("Failed to activate emergency stop");
      }
    } catch (error) {
      toast.error("Failed to activate emergency stop");
    }
    setLoading(false);
  };

  const riskUtilization = autoConfig.maxDailyLoss > 0 
    ? (Math.abs(autoConfig.currentDailyLoss) / autoConfig.maxDailyLoss) * 100 
    : 0;
  
  const tradesUtilization = autoConfig.maxDailyTrades > 0
    ? (autoConfig.currentDailyTrades / autoConfig.maxDailyTrades) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* System Status Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              System Control
            </CardTitle>
            <Badge variant={systemStatus.isActive ? "default" : "secondary"}>
              {systemStatus.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Active Trades</p>
              <p className="text-2xl font-bold">{systemStatus.activeTrades}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total P&L</p>
              <p className={`text-2xl font-bold ${systemStatus.totalProfit >= 0 ? "text-success-green" : "text-warning-red"}`}>
                ${systemStatus.totalProfit.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Health</p>
              <Badge variant={systemStatus.health === "good" ? "default" : "destructive"}>
                {systemStatus.health}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={toggleSystem}
              disabled={loading}
              className="flex-1"
              variant={systemStatus.isActive ? "destructive" : "default"}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : systemStatus.isActive ? (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Stop System
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Start System
                </>
              )}
            </Button>

            {autoConfig.emergencyStopEnabled && (
              <Button
                onClick={emergencyStop}
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Emergency Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Trading Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Auto-Trading Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-Trading Toggle */}
          <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Enable Auto-Trading</Label>
              <p className="text-sm text-muted-foreground">
                Automatically execute trades based on AI signals
              </p>
            </div>
            <Switch
              checked={autoConfig.enabled}
              onCheckedChange={(checked) => setAutoConfig({ ...autoConfig, enabled: checked })}
            />
          </div>

          {/* Risk Limits */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Risk Limits
            </h3>

            <div className="space-y-2">
              <Label>Max Daily Loss ($)</Label>
              <Input
                type="number"
                value={autoConfig.maxDailyLoss}
                onChange={(e) => setAutoConfig({ ...autoConfig, maxDailyLoss: parseFloat(e.target.value) })}
                placeholder="500"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current: ${Math.abs(autoConfig.currentDailyLoss).toFixed(2)}</span>
                <span className={riskUtilization > 80 ? "text-warning-red" : "text-success-green"}>
                  {riskUtilization.toFixed(0)}% utilized
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Daily Trades</Label>
              <Input
                type="number"
                value={autoConfig.maxDailyTrades}
                onChange={(e) => setAutoConfig({ ...autoConfig, maxDailyTrades: parseInt(e.target.value) })}
                placeholder="10"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current: {autoConfig.currentDailyTrades}</span>
                <span className={tradesUtilization > 80 ? "text-warning-red" : "text-success-green"}>
                  {tradesUtilization.toFixed(0)}% utilized
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Position Size (lots)</Label>
              <Input
                type="number"
                step="0.1"
                value={autoConfig.maxPositionSize}
                onChange={(e) => setAutoConfig({ ...autoConfig, maxPositionSize: parseFloat(e.target.value) })}
                placeholder="1.0"
              />
            </div>

            <div className="space-y-2">
              <Label>Min Confidence Score</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={autoConfig.minConfidence}
                onChange={(e) => setAutoConfig({ ...autoConfig, minConfidence: parseFloat(e.target.value) })}
                placeholder="0.7"
              />
              <p className="text-xs text-muted-foreground">Only execute trades with confidence ≥ {(autoConfig.minConfidence * 100).toFixed(0)}%</p>
            </div>
          </div>

          {/* Trading Schedule */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Trading Schedule
            </h3>

            <div className="space-y-2">
              <Label>Trading Hours (UTC)</Label>
              <Input
                type="text"
                value={autoConfig.tradingHours}
                onChange={(e) => setAutoConfig({ ...autoConfig, tradingHours: e.target.value })}
                placeholder="00:00-23:59"
              />
              <p className="text-xs text-muted-foreground">Format: HH:MM-HH:MM (e.g., 08:00-16:00)</p>
            </div>
          </div>

          {/* Emergency Stop */}
          <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg border-2 border-warning-red/20">
            <div className="space-y-1">
              <Label className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-red" />
                Emergency Stop
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable emergency stop button to immediately halt all trading
              </p>
            </div>
            <Switch
              checked={autoConfig.emergencyStopEnabled}
              onCheckedChange={(checked) => setAutoConfig({ ...autoConfig, emergencyStopEnabled: checked })}
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={updateAutoTradingConfig}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Settings className="h-4 w-4 mr-2" />
            )}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Status Indicators */}
      {autoConfig.enabled && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Auto-Trading Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-background-secondary rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Daily Loss Limit</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold">${Math.abs(autoConfig.currentDailyLoss).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">/ ${autoConfig.maxDailyLoss}</p>
                </div>
                <div className="mt-2 h-2 bg-background-tertiary rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${riskUtilization > 80 ? "bg-warning-red" : "bg-success-green"}`}
                    style={{ width: `${Math.min(riskUtilization, 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-background-secondary rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Daily Trades</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold">{autoConfig.currentDailyTrades}</p>
                  <p className="text-sm text-muted-foreground">/ {autoConfig.maxDailyTrades}</p>
                </div>
                <div className="mt-2 h-2 bg-background-tertiary rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${tradesUtilization > 80 ? "bg-warning-red" : "bg-success-green"}`}
                    style={{ width: `${Math.min(tradesUtilization, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {(riskUtilization > 80 || tradesUtilization > 80) && (
              <div className="p-3 bg-warning-red/10 border border-warning-red/20 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-red" />
                <p className="text-sm text-warning-red font-medium">
                  Warning: Approaching daily limits
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}