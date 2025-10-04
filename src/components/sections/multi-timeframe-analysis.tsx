"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  RefreshCw,
  Clock,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

interface TimeframeSignal {
  timeframe: string;
  direction: "buy" | "sell" | "hold";
  confidence: number;
  price: number;
  rsi: number;
  macd: string;
  trend: string;
}

interface MultiTimeframeAnalysisProps {
  symbol: string;
}

const TIMEFRAMES = [
  { id: "1m", label: "1 Minute", interval: 1 },
  { id: "5m", label: "5 Minutes", interval: 5 },
  { id: "1h", label: "1 Hour", interval: 60 },
  { id: "4h", label: "4 Hours", interval: 240 },
  { id: "1d", label: "Daily", interval: 1440 },
];

export function MultiTimeframeAnalysis({ symbol }: MultiTimeframeAnalysisProps) {
  const [signals, setSignals] = useState<TimeframeSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const signalPromises = TIMEFRAMES.map(async (tf) => {
        try {
          const response = await fetch(`/api/market-data?symbol=${symbol}&timeframe=${tf.id}&limit=100`);
          if (!response.ok) throw new Error(`Failed to fetch ${tf.id}`);
          
          const data = await response.json();
          
          // Simulate technical analysis
          const latestPrice = data.current?.price || 2000;
          const rsi = 45 + Math.random() * 20;
          const macdPositive = Math.random() > 0.5;
          const trendUp = Math.random() > 0.5;
          
          let direction: "buy" | "sell" | "hold" = "hold";
          let confidence = 0.5;
          
          if (rsi < 40 && macdPositive && trendUp) {
            direction = "buy";
            confidence = 0.65 + Math.random() * 0.25;
          } else if (rsi > 60 && !macdPositive && !trendUp) {
            direction = "sell";
            confidence = 0.65 + Math.random() * 0.25;
          } else {
            confidence = 0.4 + Math.random() * 0.2;
          }
          
          return {
            timeframe: tf.label,
            direction,
            confidence,
            price: latestPrice,
            rsi: parseFloat(rsi.toFixed(2)),
            macd: macdPositive ? "Bullish" : "Bearish",
            trend: trendUp ? "Uptrend" : "Downtrend",
          };
        } catch (error) {
          return {
            timeframe: tf.label,
            direction: "hold" as const,
            confidence: 0,
            price: 0,
            rsi: 0,
            macd: "N/A",
            trend: "N/A",
          };
        }
      });
      
      const results = await Promise.all(signalPromises);
      setSignals(results);
    } catch (error) {
      console.error("Failed to fetch signals:", error);
      toast.error("Failed to load multi-timeframe analysis");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSignals();
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === "buy") return <TrendingUp className="h-4 w-4 text-success-green" />;
    if (direction === "sell") return <TrendingDown className="h-4 w-4 text-warning-red" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getDirectionColor = (direction: string) => {
    if (direction === "buy") return "bg-success-green/20 border-success-green/50 text-success-green";
    if (direction === "sell") return "bg-warning-red/20 border-warning-red/50 text-warning-red";
    return "bg-secondary border-secondary text-secondary-foreground";
  };

  // Calculate overall consensus
  const buyCount = signals.filter(s => s.direction === "buy").length;
  const sellCount = signals.filter(s => s.direction === "sell").length;
  const overallDirection = buyCount > sellCount ? "buy" : sellCount > buyCount ? "sell" : "hold";
  const consensusStrength = Math.max(buyCount, sellCount) / signals.length;

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Multi-Timeframe Analysis</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Cross-timeframe signal confluence</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Consensus */}
        <div className="rounded-lg border-2 border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">Market Consensus</h4>
            <Badge variant="outline" className={getDirectionColor(overallDirection)}>
              {getDirectionIcon(overallDirection)}
              <span className="ml-1 font-bold">{overallDirection.toUpperCase()}</span>
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Signal Strength</span>
            <span className="font-bold text-primary">{(consensusStrength * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-background-tertiary overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${consensusStrength * 100}%` }}
            />
          </div>
        </div>

        {/* Timeframe Signals */}
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          )}
          
          {!loading && signals.map((signal, index) => (
            <div 
              key={index}
              className="rounded-lg border border-border bg-background-secondary p-3 hover:bg-background-tertiary transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{signal.timeframe}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`${getDirectionColor(signal.direction)} text-xs`}
                  >
                    {getDirectionIcon(signal.direction)}
                    <span className="ml-1">{signal.direction.toUpperCase()}</span>
                  </Badge>
                  <Badge variant="outline" className="text-xs border-primary/50 bg-primary/20 text-primary">
                    {(signal.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">Price</p>
                  <p className="font-semibold text-foreground">${signal.price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">RSI</p>
                  <p className={`font-semibold ${
                    signal.rsi < 40 ? "text-success-green" : 
                    signal.rsi > 60 ? "text-warning-red" : 
                    "text-foreground"
                  }`}>
                    {signal.rsi.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">MACD</p>
                  <p className={`font-semibold ${
                    signal.macd === "Bullish" ? "text-success-green" : 
                    signal.macd === "Bearish" ? "text-warning-red" : 
                    "text-foreground"
                  }`}>
                    {signal.macd}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Trend</p>
                  <p className={`font-semibold ${
                    signal.trend === "Uptrend" ? "text-success-green" : 
                    signal.trend === "Downtrend" ? "text-warning-red" : 
                    "text-foreground"
                  }`}>
                    {signal.trend}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Signal Distribution */}
        {!loading && signals.length > 0 && (
          <div className="rounded-lg border border-border bg-background-secondary p-3">
            <h4 className="text-sm font-semibold text-foreground mb-3">Signal Distribution</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-success-green/10 border border-success-green/30 p-2">
                <p className="text-2xl font-bold text-success-green">{buyCount}</p>
                <p className="text-xs text-muted-foreground">Buy Signals</p>
              </div>
              <div className="rounded-md bg-warning-red/10 border border-warning-red/30 p-2">
                <p className="text-2xl font-bold text-warning-red">{sellCount}</p>
                <p className="text-xs text-muted-foreground">Sell Signals</p>
              </div>
              <div className="rounded-md bg-background-tertiary border border-border p-2">
                <p className="text-2xl font-bold text-foreground">{signals.length - buyCount - sellCount}</p>
                <p className="text-xs text-muted-foreground">Hold Signals</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}