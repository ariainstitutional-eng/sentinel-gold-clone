"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Activity, Brain, Shield, TrendingUp } from "lucide-react";

interface SystemStatus {
  id: number | null;
  mt5Connected: boolean;
  aiActive: boolean;
  riskMonitorActive: boolean;
  degradedMode: boolean;
  lastHeartbeat: number;
}

export default function Header(): JSX.Element {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const data = await apiFetch<SystemStatus>("/api/system/status");
        if (mounted) setStatus(data);
      } catch (e) {
        // silent fail to keep header lightweight
      }
    };
    fetchStatus();
    const i = setInterval(fetchStatus, 5000);
    return () => {
      mounted = false;
      clearInterval(i);
    };
  }, []);

  const mt5Badge = status?.mt5Connected ? (
    <div className="inline-flex items-center gap-1 rounded-full bg-success-green px-2.5 py-0.5 text-xs font-semibold text-white">
      <Activity className="h-3 w-3" /> MT5 Connected
    </div>
  ) : (
    <div className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
      <Activity className="h-3 w-3" /> MT5 Disconnected
    </div>
  );

  const aiBadge = status?.aiActive ? (
    <div className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
      <Brain className="h-3 w-3" /> AI Active
    </div>
  ) : (
    <div className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
      <Brain className="h-3 w-3" /> AI Standby
    </div>
  );

  const riskBadge = status?.riskMonitorActive ? (
    <div className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
      <Shield className="h-3 w-3" /> Risk Monitor Active
    </div>
  ) : (
    <div className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
      <Shield className="h-3 w-3" /> Risk Monitor Off
    </div>
  );

  return (
    <header className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-primary p-2">
          <TrendingUp className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sentinel Gold Trader</h1>
          <p className="text-sm text-muted-foreground">AI-Powered XAUUSD Scalping System</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {mt5Badge}
        {aiBadge}
        {riskBadge}
      </div>
    </header>
  );
}