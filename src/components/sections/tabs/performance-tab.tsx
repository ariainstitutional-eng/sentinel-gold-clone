"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AlertCircle,
  BookOpen,
  LineChart,
  Calendar
} from "lucide-react";
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

interface TradeJournalEntry {
  id: number;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  volume: number;
  pnl: number | null;
  duration: number | null;
  strategy: string | null;
  notes: string | null;
  sentiment: string;
  openedAt: number;
  closedAt: number | null;
}

interface PerformanceMetric {
  id: number;
  date: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  equity: number;
}

export function PerformanceTab() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [journal, setJournal] = useState<TradeJournalEntry[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"overview" | "journal" | "metrics">("overview");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setError(null);
        const [posData, journalData, metricsData] = await Promise.all([
          fetch("/api/positions?limit=100").then(r => r.json()),
          fetch("/api/trade-journal?limit=50&sort=openedAt&order=desc").then(r => r.json()),
          fetch("/api/performance-metrics?limit=30&sort=date&order=desc").then(r => r.json())
        ]);
        
        if (mounted) {
          setPositions(posData);
          setJournal(journalData || []);
          setMetrics(metricsData || []);
        }
      } catch (error) {
        console.error("Failed to load performance data:", error);
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

  // Calculate equity curve
  const latestMetric = metrics[0];
  const equityCurve = metrics.slice(0, 7).reverse();

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="bg-warning-red/10 border border-warning-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning-red flex-shrink-0" />
          <p className="text-sm text-warning-red">{error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant={selectedTab === "overview" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTab("overview")}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={selectedTab === "journal" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTab("journal")}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Trade Journal
        </Button>
        <Button
          variant={selectedTab === "metrics" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTab("metrics")}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Daily Metrics
        </Button>
      </div>

      {/* Overview Tab */}
      {selectedTab === "overview" && (
        <>
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

          {/* Equity Curve */}
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-primary" />
                <CardTitle>Equity Curve (Last 7 Days)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {equityCurve.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <LineChart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No equity data available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {equityCurve.map((metric, idx) => (
                    <div key={metric.id} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24">
                        {new Date(metric.date).toLocaleDateString()}
                      </span>
                      <div className="flex-1 h-8 bg-background-tertiary rounded-full overflow-hidden border border-border relative">
                        <div 
                          className={`h-full transition-all ${metric.totalPnL >= 0 ? 'bg-success-green' : 'bg-warning-red'}`}
                          style={{ width: `${Math.min(Math.abs(metric.equity / 15000) * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-24 text-right ${metric.totalPnL >= 0 ? 'text-success-green' : 'text-warning-red'}`}>
                        ${metric.equity.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                    {positions.slice(0, 10).map((position) => (
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
        </>
      )}

      {/* Trade Journal Tab */}
      {selectedTab === "journal" && (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Trade Journal</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Detailed analysis of your trades</p>
              </div>
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                {journal.length} Entries
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {journal.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No journal entries found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {journal.map((entry) => (
                  <div key={entry.id} className="bg-background-secondary rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">{entry.symbol}</Badge>
                        <Badge className={entry.side === "buy" ? "bg-success-green/20 text-success-green" : "bg-warning-red/20 text-warning-red"}>
                          {entry.side.toUpperCase()}
                        </Badge>
                        {entry.strategy && (
                          <Badge variant="secondary">{entry.strategy}</Badge>
                        )}
                      </div>
                      {entry.pnl !== null && (
                        <span className={`text-lg font-bold ${entry.pnl >= 0 ? 'text-success-green' : 'text-warning-red'}`}>
                          {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Entry:</span>
                        <span className="ml-2 font-mono">${entry.entryPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Exit:</span>
                        <span className="ml-2 font-mono">${entry.exitPrice?.toFixed(2) || 'Open'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Volume:</span>
                        <span className="ml-2 font-mono">{entry.volume.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="ml-2">{entry.duration ? `${Math.floor(entry.duration / 60000)}m` : 'N/A'}</span>
                      </div>
                    </div>
                    {entry.notes && (
                      <div className="bg-background-tertiary rounded p-2 text-sm text-muted-foreground border-l-2 border-primary">
                        {entry.notes}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>{new Date(entry.openedAt).toLocaleString()}</span>
                      <Badge variant="outline" className={
                        entry.sentiment === 'positive' ? 'bg-success-green/10 text-success-green' :
                        entry.sentiment === 'negative' ? 'bg-warning-red/10 text-warning-red' :
                        'bg-secondary'
                      }>
                        {entry.sentiment}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Metrics Tab */}
      {selectedTab === "metrics" && (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Daily Performance Metrics</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Historical performance data</p>
              </div>
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                {metrics.length} Days
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No metrics data available</p>
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background-secondary">
                      <TableHead>Date</TableHead>
                      <TableHead>Trades</TableHead>
                      <TableHead>Win Rate</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead>Profit Factor</TableHead>
                      <TableHead>Sharpe Ratio</TableHead>
                      <TableHead>Max DD</TableHead>
                      <TableHead>Equity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((metric) => (
                      <TableRow key={metric.id} className="hover:bg-background-secondary/50">
                        <TableCell className="font-medium">
                          {new Date(metric.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-semibold">{metric.totalTrades}</span>
                            <div className="text-xs text-muted-foreground">
                              {metric.winningTrades}W / {metric.losingTrades}L
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{metric.winRate.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${metric.totalPnL >= 0 ? 'text-success-green' : 'text-warning-red'}`}>
                            {metric.totalPnL >= 0 ? '+' : ''}${metric.totalPnL.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{metric.profitFactor.toFixed(2)}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono ${metric.sharpeRatio >= 1 ? 'text-success-green' : metric.sharpeRatio >= 0 ? 'text-foreground' : 'text-warning-red'}`}>
                            {metric.sharpeRatio.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono ${metric.maxDrawdown > 10 ? 'text-warning-red' : 'text-muted-foreground'}`}>
                            {metric.maxDrawdown.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">${metric.equity.toFixed(2)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}