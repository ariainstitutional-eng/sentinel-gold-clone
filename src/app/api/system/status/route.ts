import { NextRequest, NextResponse } from "next/server";
import { SystemMetricsCollector } from "@/lib/system-metrics";

export async function GET(req: NextRequest) {
  try {
    // Collect REAL system metrics
    const metrics = await SystemMetricsCollector.collect();

    return NextResponse.json({
      success: true,
      metrics: {
        cpu: {
          usage: metrics.cpu.usage.toFixed(2),
          cores: metrics.cpu.cores,
          speed: metrics.cpu.speed.toFixed(2),
          temperature: metrics.cpu.temperature > 0 ? metrics.cpu.temperature.toFixed(1) : "N/A",
        },
        memory: {
          total: SystemMetricsCollector.formatBytes(metrics.memory.total),
          used: SystemMetricsCollector.formatBytes(metrics.memory.used),
          free: SystemMetricsCollector.formatBytes(metrics.memory.free),
          percentage: metrics.memory.percentage.toFixed(2),
        },
        network: {
          rx: SystemMetricsCollector.formatBytes(metrics.network.rx) + "/s",
          tx: SystemMetricsCollector.formatBytes(metrics.network.tx) + "/s",
          latency: metrics.network.latency > 0 ? `${metrics.network.latency}ms` : "N/A",
        },
        disk: {
          total: SystemMetricsCollector.formatBytes(metrics.disk.total),
          used: SystemMetricsCollector.formatBytes(metrics.disk.used),
          free: SystemMetricsCollector.formatBytes(metrics.disk.free),
          percentage: metrics.disk.percentage.toFixed(2),
        },
        process: {
          cpu: metrics.process.cpu.toFixed(2),
          memory: metrics.process.memory.toFixed(2),
          uptime: SystemMetricsCollector.formatUptime(metrics.process.uptime),
        },
      },
      timestamp: metrics.timestamp,
    });
  } catch (error: any) {
    console.error("Error fetching system status:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}