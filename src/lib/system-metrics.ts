/**
 * Real System Metrics Collection
 * CPU, Memory, Network, Latency monitoring
 */

import * as si from 'systeminformation';

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    speed: number;
    temperature: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    rx: number; // bytes received per second
    tx: number; // bytes transmitted per second
    latency: number; // ms
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  process: {
    cpu: number;
    memory: number;
    uptime: number;
  };
  timestamp: number;
}

export class SystemMetricsCollector {
  private static lastNetworkStats: si.Systeminformation.NetworkStatsData[] | null = null;
  private static lastNetworkTime: number = 0;

  /**
   * Collect all system metrics
   */
  static async collect(): Promise<SystemMetrics> {
    try {
      const [cpuData, memData, networkData, diskData, processData, cpuTemp] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.networkStats(),
        si.fsSize(),
        si.processes(),
        si.cpuTemperature(),
      ]);

      // Calculate network throughput
      const networkThroughput = this.calculateNetworkThroughput(networkData);

      // Get main disk (usually first one)
      const mainDisk = diskData[0] || {
        size: 0,
        used: 0,
        available: 0,
        use: 0,
      };

      // Get current process stats
      const currentPid = process.pid;
      const currentProcess = processData.list.find((p) => p.pid === currentPid);

      const metrics: SystemMetrics = {
        cpu: {
          usage: cpuData.currentLoad,
          cores: cpuData.cpus.length,
          speed: cpuData.cpus[0]?.load || 0,
          temperature: cpuTemp.main || 0,
        },
        memory: {
          total: memData.total,
          used: memData.used,
          free: memData.free,
          percentage: (memData.used / memData.total) * 100,
        },
        network: {
          rx: networkThroughput.rx,
          tx: networkThroughput.tx,
          latency: await this.measureLatency(),
        },
        disk: {
          total: mainDisk.size,
          used: mainDisk.used,
          free: mainDisk.available,
          percentage: mainDisk.use,
        },
        process: {
          cpu: currentProcess?.cpu || 0,
          memory: currentProcess?.mem || 0,
          uptime: process.uptime(),
        },
        timestamp: Date.now(),
      };

      return metrics;
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      // Return fallback metrics
      return this.getFallbackMetrics();
    }
  }

  /**
   * Calculate network throughput (bytes per second)
   */
  private static calculateNetworkThroughput(
    currentStats: si.Systeminformation.NetworkStatsData[]
  ): { rx: number; tx: number } {
    const currentTime = Date.now();

    if (!this.lastNetworkStats || !this.lastNetworkTime) {
      this.lastNetworkStats = currentStats;
      this.lastNetworkTime = currentTime;
      return { rx: 0, tx: 0 };
    }

    const timeDiff = (currentTime - this.lastNetworkTime) / 1000; // seconds

    // Sum all interfaces
    const currentRx = currentStats.reduce((sum, stat) => sum + stat.rx_bytes, 0);
    const currentTx = currentStats.reduce((sum, stat) => sum + stat.tx_bytes, 0);
    const lastRx = this.lastNetworkStats.reduce((sum, stat) => sum + stat.rx_bytes, 0);
    const lastTx = this.lastNetworkStats.reduce((sum, stat) => sum + stat.tx_bytes, 0);

    const rxPerSecond = Math.max(0, (currentRx - lastRx) / timeDiff);
    const txPerSecond = Math.max(0, (currentTx - lastTx) / timeDiff);

    this.lastNetworkStats = currentStats;
    this.lastNetworkTime = currentTime;

    return {
      rx: Math.round(rxPerSecond),
      tx: Math.round(txPerSecond),
    };
  }

  /**
   * Measure network latency (ping to Google DNS)
   */
  private static async measureLatency(): Promise<number> {
    const startTime = Date.now();
    try {
      await fetch('https://dns.google/resolve?name=google.com&type=A', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return Date.now() - startTime;
    } catch (error) {
      return -1; // Indicates failure
    }
  }

  /**
   * Get fallback metrics when real collection fails
   */
  private static getFallbackMetrics(): SystemMetrics {
    return {
      cpu: {
        usage: 0,
        cores: 0,
        speed: 0,
        temperature: 0,
      },
      memory: {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
      },
      network: {
        rx: 0,
        tx: 0,
        latency: -1,
      },
      disk: {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
      },
      process: {
        cpu: 0,
        memory: 0,
        uptime: process.uptime(),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Format uptime to human-readable string
   */
  static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }
}