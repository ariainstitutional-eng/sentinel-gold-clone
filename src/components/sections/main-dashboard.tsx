"use client";

import {
  Activity,
  BrainCircuit,
  Cog,
  Info,
  RefreshCw,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';

interface Signal {
  direction: string;
  confidence: number;
  score: number;
  rationale?: string;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketData {
  symbol: string;
  timeframe: string;
  candles: CandleData[];
  current: {
    price: number;
    bid: number;
    ask: number;
    timestamp: number;
  };
}

const TradingChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [selectedTF, setSelectedTF] = useState("1m");
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      crosshair: {
        mode: 1,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#f59e0b',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Fetch market data
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch market data
        const data = await apiFetch<MarketData>(
          `/api/market-data?timeframe=${selectedTF}&limit=200`
        );
        
        if (mounted) {
          setMarketData(data);
          
          // Update chart
          if (candlestickSeriesRef.current && volumeSeriesRef.current) {
            candlestickSeriesRef.current.setData(data.candles);
            volumeSeriesRef.current.setData(
              data.candles.map(c => ({
                time: c.time,
                value: c.volume,
                color: c.close >= c.open ? '#10b98140' : '#ef444440',
              }))
            );
          }
        }

        // Fetch AI signal
        const signalData = await apiFetch<Signal>("/api/fused/latest?symbol=XAUUSD&limit=1");
        if (mounted) setSignal(signalData);
        
      } catch (error) {
        console.error("Failed to load market data:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedTF]);

  const signalBadge = useMemo(() => {
    if (!signal) return null;

    const direction = signal.direction.toUpperCase();
    const bgColor =
      direction === "BUY"
        ? "bg-success-green/20 border-success-green/50"
        : direction === "SELL"
        ? "bg-warning-red/20 border-warning-red/50"
        : "bg-secondary border-secondary";
    const textColor =
      direction === "BUY"
        ? "text-success-green"
        : direction === "SELL"
        ? "text-warning-red"
        : "text-secondary-foreground";

    return (
      <div className="flex gap-2">
        <Badge
          variant="outline"
          className={`${bgColor} ${textColor} text-xs font-semibold`}
        >
          AI Signal: {direction === "BUY" ? "STRONG BUY" : direction === "SELL" ? "STRONG SELL" : "NEUTRAL"}
        </Badge>
        <Badge
          variant="outline"
          className="border-primary/50 bg-primary/20 text-xs font-semibold text-primary"
        >
          Confidence: {(signal.confidence * 100).toFixed(0)}%
        </Badge>
      </div>
    );
  }, [signal]);

  const tpSl = useMemo(() => {
    if (!marketData || !signal) {
      return { tp: "N/A", sl: "N/A", rr: "N/A" };
    }

    const currentPrice = marketData.current.price;
    const isBuy = signal.direction === "buy";
    const tp = isBuy ? currentPrice + 10 : currentPrice - 10;
    const sl = isBuy ? currentPrice - 4 : currentPrice + 4;
    const rr = (Math.abs(tp - currentPrice) / Math.abs(sl - currentPrice)).toFixed(1);

    return {
      tp: tp.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
      sl: sl.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
      rr: `1:${rr}`,
    };
  }, [marketData, signal]);

  const currentPrice = marketData?.current.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <Card className="border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">
            XAUUSD Chart
          </h3>
          {marketData && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1 bg-secondary text-secondary-foreground">
                <Activity className="h-3 w-3" />
                LIVE
              </Badge>
              <span className="text-xl font-bold text-primary">
                ${currentPrice}
              </span>
            </div>
          )}
        </div>
        <Tabs value={selectedTF} onValueChange={setSelectedTF}>
          <TabsList className="bg-secondary/50 p-1">
            {["1m", "5m", "15m", "30m", "1h", "4h", "1d"].map((tf) => (
              <TabsTrigger
                key={tf}
                value={tf}
                className="rounded-sm px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {tf.toUpperCase()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading market data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-start justify-between">
            {signalBadge}
            <div className="text-right text-xs">
              <p className="font-semibold text-success-green">TP: {tpSl.tp}</p>
              <p className="font-semibold text-warning-red">SL: {tpSl.sl}</p>
              <p className="font-semibold text-primary">R:R {tpSl.rr}</p>
            </div>
          </div>

          <div ref={chartContainerRef} className="w-full" />

          {marketData && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex gap-4">
                <span>Bid: <span className="font-semibold text-warning-red">{marketData.current.bid.toFixed(2)}</span></span>
                <span>Ask: <span className="font-semibold text-success-green">{marketData.current.ask.toFixed(2)}</span></span>
                <span>Spread: <span className="font-semibold text-foreground">{(marketData.current.ask - marketData.current.bid).toFixed(2)}</span></span>
              </div>
              <span className="text-primary">
                Last updated: {new Date(marketData.current.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

const AISignalPanel = () => {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const generateRealAISignal = useCallback(async () => {
    try {
      setRegenerating(true);
      
      // First fetch latest market data
      const marketResponse = await apiFetch<MarketData>("/api/market-data?timeframe=1h&limit=100");
      setMarketData(marketResponse);
      
      // Then generate AI signal using OpenAI
      const aiResponse = await apiFetch<{ success: boolean; signal: any }>("/api/ai/generate-signal", {
        method: "POST",
        body: {
          marketData: marketResponse,
          symbol: "XAUUSD",
          timeframe: "1h",
          strategy: "Conservative Trend"
        }
      });
      
      if (aiResponse.success && aiResponse.signal) {
        setSignal({
          direction: aiResponse.signal.direction.toLowerCase(),
          confidence: aiResponse.signal.confidence / 100,
          score: aiResponse.signal.confidence / 100,
          rationale: aiResponse.signal.reasoning
        });
      }
    } catch (error) {
      console.error("Failed to generate AI signal:", error);
      // Fallback to fused signal
      try {
        const data = await apiFetch<Signal>("/api/fused/latest?symbol=XAUUSD&limit=1");
        setSignal(data);
      } catch {}
    } finally {
      setRegenerating(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      setLoading(true);
      await generateRealAISignal();
      if (mounted) setLoading(false);
    };
    load();
    // Refresh every 5 minutes
    const i = setInterval(load, 300000);
    return () => {
      mounted = false;
      clearInterval(i);
    };
  }, [generateRealAISignal]);

  const badgeClass = useMemo(() => {
    if (!signal) return "bg-secondary text-secondary-foreground";
    if (signal.direction === "buy") return "bg-success-green/20 text-success-green border-success-green/40";
    if (signal.direction === "sell") return "bg-warning-red/20 text-warning-red border-warning-red/40";
    return "bg-secondary text-secondary-foreground";
  }, [signal]);

  return (
    <Card className="border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-accent-purple/20 p-2">
            <BrainCircuit className="h-5 w-5 text-accent-purple" />
          </div>
          <div>
            <h3 className="text-base font-semibold">AI Signal Panel</h3>
            <p className="text-sm text-muted-foreground">OpenAI-Powered Analysis</p>
          </div>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={generateRealAISignal}
          disabled={regenerating || loading}
          className="h-8 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="pt-4 space-y-2">
        {loading && (
          <p className="text-sm text-muted-foreground">Generating AI signal with OpenAI…</p>
        )}
        {!loading && signal && (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={`text-xs font-semibold ${badgeClass}`}>
                Direction: {signal.direction.toUpperCase()}
              </Badge>
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-primary">Confidence:</span> {(signal.confidence * 100).toFixed(0)}%
              </div>
            </div>
            {signal.rationale && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 mt-2">
                {signal.rationale}
              </p>
            )}
          </>
        )}
        {!loading && !signal && (
          <p className="text-sm">Click refresh to generate AI signal.</p>
        )}
      </CardContent>
    </Card>
  );
};

const AIModelControl = () => {
  interface Model { id: number; name: string; provider: string; version: string; status: "active" | "standby" | "training" }
  const [models, setModels] = useState<Model[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const loadModels = useCallback(async () => {
    try {
      const data = await apiFetch<Model[]>("/api/models?limit=50");
      setModels(data);
      const active = data.find((m) => m.status === "active");
      setSelectedId(active ? active.id : data[0]?.id ?? null);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const setStatus = useCallback(async (id: number, status: "active" | "standby" | "training") => {
    setBusy(true);
    try {
      await apiFetch(`/api/models/${id}/status`, { method: "PATCH", body: { status } });
      await loadModels();
    } finally {
      setBusy(false);
    }
  }, [loadModels]);

  const onChangeModel = useCallback(async (idStr: string) => {
    const id = parseInt(idStr, 10);
    setSelectedId(id);
    await setStatus(id, "active");
  }, [setStatus]);

  const onRetrain = useCallback(async () => {
    if (!selectedId) return;
    await setStatus(selectedId, "training");
    setTimeout(() => {
      setStatus(selectedId, "standby");
    }, 3000);
  }, [selectedId, setStatus]);

  return (
    <Card className="border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
        <div className="rounded-full bg-accent-purple/20 p-2">
          <Cog className="h-5 w-5 text-accent-purple" />
        </div>
        <div>
          <h3 className="text-base font-semibold">AI Model Control</h3>
          <p className="text-sm text-muted-foreground">HRM Retraining System</p>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2">
          <Label htmlFor="ai-model-select" className="text-xs">
            Active Model
          </Label>
          <Select onValueChange={onChangeModel} value={selectedId ? String(selectedId) : undefined}>
            <SelectTrigger id="ai-model-select" className="bg-background-tertiary">
              <SelectValue placeholder="Select AI Model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name} • {m.provider} • {m.version} {m.status === "training" ? "(training)" : m.status === "active" ? "(active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="bg-background-tertiary" disabled>
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
          <Button variant="secondary" className="bg-background-tertiary" onClick={onRetrain} disabled={busy || !selectedId}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retrain
          </Button>
        </div>
      </CardContent>
      <CardFooter className="mt-4 p-0">
        <div className="flex w-full items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-xs">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div>
            <span className="font-semibold text-primary">HRM Status:</span>
            <p className="text-muted-foreground">
              Continuous learning enabled. Model adapts based on performance feedback.
            </p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

export default function MainDashboard() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <TradingChart />
      </div>
      <div className="space-y-4 lg:col-span-4">
        <AISignalPanel />
        <AIModelControl />
      </div>
    </div>
  );
}