"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Percent,
  Activity,
  Loader2,
  AlertCircle
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface Position {
  id: number;
  symbol: string;
  side: string;
  volume: number;
  entryPrice: number;
  closedAt: number | null;
  pnl: number | null;
  status: string;
  openedAt: number;
  sl: number | null;
  tp: number | null;
}

export function PerformanceTab() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setError(null);
        const data = await apiFetch<Position[]>("/api/positions?limit=100");
        if (mounted) setPositions(data);
      } catch (error) {
        console.error("Failed to load positions:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to load performance data";
        if (mounted) {
          setError(errorMsg);
          toast.error(errorMsg);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const closedPositions = positions.filter(p => p.status === "closed");
  const openPositions = positions.filter(p => p.status === "open");
  
  const totalPnL = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const winningTrades = closedPositions.filter(p => (p.pnl || 0) > 0);
  const losingTrades = closedPositions.filter(p => (p.pnl || 0) < 0);
  const winRate = closedPositions.length > 0 ? (winningTrades.length / closedPositions.length) * 100 : 0;
  
  const avgWin = winningTrades.length > 0 
    ? winningTrades.reduce((sum, p) => sum + (p.pnl || 0), 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0 
    ? Math.abs(losingTrades.reduce((sum, p) => sum + (p.pnl || 0), 0) / losingTrades.length)
    : 0;
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="bg-warning-red/10 border border-warning-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning-red flex-shrink-0" />
          <p className="text-sm text-warning-red">{error}</p>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-success-green' : 'text-warning-red'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {closedPositions.length} closed trades
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {winningTrades.length}W / {losingTrades.length}L
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Factor</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{profitFactor.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg Win: ${avgWin.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Positions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{openPositions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades Table */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Trade History</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Recent trading activity</p>
            </div>
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              {positions.length} Total Trades
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-background-secondary">
                  <TableHead>ID</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>SL/TP</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No trades found
                    </TableCell>
                  </TableRow>
                )}
                {positions.map((position) => (
                  <TableRow key={position.id} className="hover:bg-background-secondary/50">
                    <TableCell className="font-medium">#{position.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {position.symbol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          position.side === "buy"
                            ? "bg-success-green/20 text-success-green border-success-green/40"
                            : "bg-warning-red/20 text-warning-red border-warning-red/40"
                        }
                      >
                        {position.side === "buy" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {position.side.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{position.volume.toFixed(2)}</TableCell>
                    <TableCell className="font-mono">${position.entryPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="space-y-1">
                        {position.sl && (
                          <div className="text-warning-red">SL: ${position.sl.toFixed(2)}</div>
                        )}
                        {position.tp && (
                          <div className="text-success-green">TP: ${position.tp.toFixed(2)}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {position.pnl !== null ? (
                        <span
                          className={`font-bold ${
                            position.pnl >= 0 ? "text-success-green" : "text-warning-red"
                          }`}
                        >
                          {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={position.status === "open" ? "default" : "secondary"}
                        className={
                          position.status === "open"
                            ? "bg-primary text-primary-foreground"
                            : ""
                        }
                      >
                        {position.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(position.openedAt * 1000).toLocaleDateString()}<br />
                      {new Date(position.openedAt * 1000).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}