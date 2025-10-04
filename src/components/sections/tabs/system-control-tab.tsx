"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Zap,
  Activity,
  Brain,
  Shield,
  Server,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { SystemMetrics } from "../system-metrics";

interface SystemStatus {
  id: number | null;
  mt5Connected: boolean;
  aiActive: boolean;
  riskMonitorActive: boolean;
  degradedMode: boolean;
  lastHeartbeat: number;
}

interface Account {
  id: number;
  broker: string;
  server: string;
  login: string;
  status: "connected" | "disconnected";
  balance: number;
  equity: number;
}

export function SystemControlTab() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statusData, accountsData] = await Promise.all([
        apiFetch<SystemStatus>("/api/system/status"),
        apiFetch<Account[]>("/api/accounts?limit=10")
      ]);
      
      setStatus(statusData);
      setAccounts(accountsData);
    } catch (error) {
      console.error("Failed to load system data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleToggleAI = useCallback(async (active: boolean) => {
    try {
      setBusy(true);
      await apiFetch("/api/system/toggle", {
        method: "POST",
        body: { aiActive: active },
      });
      toast.success(active ? "AI System Activated" : "AI System Deactivated");
      await loadData();
    } catch (error) {
      toast.error("Failed to toggle AI system");
    } finally {
      setBusy(false);
    }
  }, [loadData]);

  const handleToggleRiskMonitor = useCallback(async (active: boolean) => {
    try {
      setBusy(true);
      await apiFetch("/api/system/toggle", {
        method: "POST",
        body: { riskMonitorActive: active },
      });
      toast.success(active ? "Risk Monitor Activated" : "Risk Monitor Deactivated");
      await loadData();
    } catch (error) {
      toast.error("Failed to toggle risk monitor");
    } finally {
      setBusy(false);
    }
  }, [loadData]);

  const handleConnectMT5 = useCallback(async () => {
    try {
      setBusy(true);
      
      const connectionResponse = await apiFetch<any>("/api/mt5/connect", {
        method: "POST",
        body: {}
      });
      
      if (connectionResponse.success) {
        await apiFetch<Account>("/api/accounts", {
          method: "POST",
          body: {
            broker: "FBS",
            server: connectionResponse.data?.server || "FBS-Demo",
            login: connectionResponse.data?.login || "103936248",
            alias: connectionResponse.connection === "mt5" ? "MT5 Live Session" : "MT5 Demo",
            balance: 0,
            equity: 0,
            status: connectionResponse.connection === "mt5" ? "connected" : "disconnected",
          },
        });
        
        toast.success("MT5 Account Connected Successfully");
        await loadData();
      }
    } catch (error) {
      console.error("MT5 connection failed:", error);
      toast.error("Failed to connect MT5 account");
    } finally {
      setBusy(false);
    }
  }, [loadData]);

  const handleEmergencyStop = useCallback(async () => {
    try {
      setBusy(true);
      await apiFetch("/api/system/toggle", {
        method: "POST",
        body: { aiActive: false, riskMonitorActive: true },
      });
      toast.success("Emergency Stop Activated - All systems halted");
      await loadData();
    } catch (error) {
      toast.error("Failed to activate emergency stop");
    } finally {
      setBusy(false);
    }
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const liveAccount = accounts.find((a) => a.status === "connected");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* System Status Overview */}
      <div className="lg:col-span-8 space-y-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">System Control Center</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Manage trading system components</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={busy}
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Component Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-background-secondary p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">MT5 Connection</span>
                  </div>
                  {status?.mt5Connected ? (
                    <CheckCircle className="h-5 w-5 text-success-green" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {status?.mt5Connected ? "Connected and streaming live data" : "Not connected to MT5 terminal"}
                </p>
                <Badge className={status?.mt5Connected ? "bg-success-green text-white" : "bg-secondary text-secondary-foreground"}>
                  {status?.mt5Connected ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>

              <div className="rounded-lg border border-border bg-background-secondary p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-accent-purple" />
                    <span className="font-semibold text-foreground">AI Trading System</span>
                  </div>
                  {status?.aiActive ? (
                    <CheckCircle className="h-5 w-5 text-success-green" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {status?.aiActive ? "AI actively generating signals" : "AI system is on standby"}
                </p>
                <Badge className={status?.aiActive ? "bg-accent-purple text-white" : "bg-secondary text-secondary-foreground"}>
                  {status?.aiActive ? "ACTIVE" : "STANDBY"}
                </Badge>
              </div>

              <div className="rounded-lg border border-border bg-background-secondary p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-gold-primary" />
                    <span className="font-semibold text-foreground">Risk Monitor</span>
                  </div>
                  {status?.riskMonitorActive ? (
                    <CheckCircle className="h-5 w-5 text-success-green" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {status?.riskMonitorActive ? "Capital protection enabled" : "Risk monitoring disabled"}
                </p>
                <Badge className={status?.riskMonitorActive ? "bg-gold-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}>
                  {status?.riskMonitorActive ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>

              <div className="rounded-lg border border-border bg-background-secondary p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">System Health</span>
                  </div>
                  {!status?.degradedMode ? (
                    <CheckCircle className="h-5 w-5 text-success-green" />
                  ) : (
                    <XCircle className="h-5 w-5 text-warning-red" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {!status?.degradedMode ? "All systems operational" : "Running in degraded mode"}
                </p>
                <Badge className={!status?.degradedMode ? "bg-success-green text-white" : "bg-warning-red text-white"}>
                  {!status?.degradedMode ? "HEALTHY" : "DEGRADED"}
                </Badge>
              </div>
            </div>

            {/* System Controls */}
            <div className="rounded-lg border border-border bg-background-secondary p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">System Controls</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-toggle" className="text-base font-medium">AI Trading System</Label>
                    <p className="text-sm text-muted-foreground">Enable or disable automated signal generation</p>
                  </div>
                  <Switch
                    id="ai-toggle"
                    checked={status?.aiActive || false}
                    onCheckedChange={handleToggleAI}
                    disabled={busy}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="risk-toggle" className="text-base font-medium">Risk Monitor</Label>
                    <p className="text-sm text-muted-foreground">Enable or disable risk management controls</p>
                  </div>
                  <Switch
                    id="risk-toggle"
                    checked={status?.riskMonitorActive || false}
                    onCheckedChange={handleToggleRiskMonitor}
                    disabled={busy}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="w-full"
                onClick={handleConnectMT5}
                disabled={busy}
              >
                <Zap className="mr-2 h-4 w-4" />
                {liveAccount ? "Reconnect MT5" : "Connect MT5"}
              </Button>
              <Button
                variant="destructive"
                className="w-full bg-warning-red hover:bg-warning-red/90"
                onClick={handleEmergencyStop}
                disabled={busy}
              >
                <Zap className="mr-2 h-4 w-4" />
                Emergency Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account & Metrics Sidebar */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Connected Account</CardTitle>
          </CardHeader>
          <CardContent>
            {liveAccount ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Broker</p>
                  <p className="font-semibold text-foreground">{liveAccount.broker}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Server</p>
                  <p className="font-semibold text-foreground">{liveAccount.server}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Login</p>
                  <p className="font-semibold text-foreground">{liveAccount.login}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-md bg-background-primary p-2 border border-border">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="font-semibold text-foreground">${liveAccount.balance.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-background-primary p-2 border border-border">
                    <p className="text-xs text-muted-foreground">Equity</p>
                    <p className="font-semibold text-foreground">${liveAccount.equity.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No account connected</p>
              </div>
            )}
          </CardContent>
        </Card>

        <SystemMetrics />
      </div>
    </div>
  );
}