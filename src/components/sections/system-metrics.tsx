import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, Zap, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  apiStatus: "online" | "offline" | "degraded";
  databaseStatus: "connected" | "disconnected" | "error";
}

export const SystemMetrics = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateMetrics = async () => {
      try {
        // Fetch real system metrics from API
        const data = await apiFetch<SystemMetrics>("/api/system/status");
        setMetrics(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch system metrics:", err);
        setError("Unable to fetch system metrics");
        // Set fallback status display
        setMetrics({
          cpu: 0,
          memory: 0,
          uptime: Date.now(),
          apiStatus: "offline",
          databaseStatus: "disconnected"
        });
      } finally {
        setLoading(false);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (timestamp: number) => {
    const seconds = Math.floor(timestamp / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "connected":
        return { bg: "bg-success-green/10", border: "border-success-green/30", text: "text-success-green" };
      case "offline":
      case "disconnected":
        return { bg: "bg-warning-red/10", border: "border-warning-red/30", text: "text-warning-red" };
      case "degraded":
      case "error":
        return { bg: "bg-gold-secondary/10", border: "border-gold-secondary/30", text: "text-gold-secondary" };
      default:
        return { bg: "bg-secondary/10", border: "border-secondary/30", text: "text-secondary-foreground" };
    }
  };

  if (loading) {
    return (
      <Card className="lg:col-span-3 bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-green/20 rounded-lg">
              <Activity className="h-5 w-5 text-success-green" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">System Metrics</CardTitle>
              <CardDescription className="text-sm">Performance Monitor</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading metrics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-3 bg-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-green/20 rounded-lg">
              <Activity className="h-5 w-5 text-success-green" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">System Metrics</CardTitle>
              <CardDescription className="text-sm">Performance Monitor</CardDescription>
            </div>
          </div>
          {error && (
            <AlertCircle className="h-4 w-4 text-warning-red" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md border border-warning-red/30 bg-warning-red/10 p-3 mb-4">
            <p className="text-xs text-warning-red">{error}</p>
          </div>
        )}

        {metrics && (
          <>
            {/* CPU Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">CPU Usage</span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  {metrics.cpu.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.cpu} 
                className="h-2 bg-background-tertiary [&>div]:bg-primary"
              />
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-accent-purple" />
                  <span className="text-sm font-medium">Memory Usage</span>
                </div>
                <span className="text-sm font-semibold text-accent-purple">
                  {metrics.memory.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.memory} 
                className="h-2 bg-background-tertiary [&>div]:bg-accent-purple"
              />
            </div>

            {/* System Uptime */}
            <div className="rounded-md border border-border-color p-3 bg-background-tertiary/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-success-green" />
                  <span className="text-sm font-medium">System Uptime</span>
                </div>
                <span className="text-sm font-semibold text-success-green">
                  {formatUptime(metrics.uptime)}
                </span>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-md border ${getStatusColor(metrics.apiStatus).border} ${getStatusColor(metrics.apiStatus).bg} p-2.5`}>
                <p className="text-xs text-muted-foreground mb-1">API Status</p>
                <p className={`text-sm font-semibold ${getStatusColor(metrics.apiStatus).text} capitalize`}>
                  {metrics.apiStatus}
                </p>
              </div>
              <div className={`rounded-md border ${getStatusColor(metrics.databaseStatus).border} ${getStatusColor(metrics.databaseStatus).bg} p-2.5`}>
                <p className="text-xs text-muted-foreground mb-1">Database</p>
                <p className={`text-sm font-semibold ${getStatusColor(metrics.databaseStatus).text} capitalize`}>
                  {metrics.databaseStatus}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};