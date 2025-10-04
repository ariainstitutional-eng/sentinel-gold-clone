import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
}

export const SystemMetrics = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    uptime: 0
  });

  useEffect(() => {
    // Simulate system metrics
    const updateMetrics = () => {
      setMetrics({
        cpu: 15 + Math.random() * 10, // 15-25% CPU usage
        memory: 45 + Math.random() * 10, // 45-55% memory usage
        uptime: Date.now()
      });
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
          <div className="rounded-md border border-success-green/30 bg-success-green/10 p-2.5">
            <p className="text-xs text-muted-foreground mb-1">API Status</p>
            <p className="text-sm font-semibold text-success-green">Online</p>
          </div>
          <div className="rounded-md border border-success-green/30 bg-success-green/10 p-2.5">
            <p className="text-xs text-muted-foreground mb-1">Database</p>
            <p className="text-sm font-semibold text-success-green">Connected</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};