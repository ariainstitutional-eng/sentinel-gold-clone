"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  BrainCircuit, 
  RefreshCw, 
  TrendingUp,
  TrendingDown,
  AlertCircle
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Script from "next/script";
import { SymbolSelector, SYMBOLS, type Symbol } from "@/components/sections/symbol-selector";

interface Signal {
  direction: string;
  confidence: number;
  score: number;
  rationale?: string;
}

interface MarketData {
  symbol: string;
  current: {
    price: number;
    bid: number;
    ask: number;
    timestamp: number;
  };
}

declare global {
  interface Window {
    TradingView: any;
  }
}

export function TradingTab() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [tvLoaded, setTvLoaded] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol>(SYMBOLS[0]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  // Initialize TradingView chart
  useEffect(() => {
    if (!tvLoaded || !chartContainerRef.current) return;

    const container = chartContainerRef.current;

    // Clean up existing widget
    try {
      if (container && container.innerHTML) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
    widgetRef.current = null;

    // Create new widget
    let widget: any = null;
    try {
      widget = new window.TradingView.widget({
        autosize: true,
        symbol: selectedSymbol.tvSymbol,
        interval: "5",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: container.id,
        backgroundColor: "rgba(26, 27, 35, 0.5)",
        gridColor: "rgba(55, 65, 81, 0.3)",
        toolbar_bg: "#1a1b23",
        studies: [
          "MASimple@tv-basicstudies",
          "RSI@tv-basicstudies",
          "MACD@tv-basicstudies"
        ],
        disabled_features: [
          "use_localstorage_for_settings",
          "header_widget"
        ],
        enabled_features: [
          "study_templates",
          "dont_show_boolean_study_arguments"
        ],
        overrides: {
          "mainSeriesProperties.candleStyle.upColor": "#10b981",
          "mainSeriesProperties.candleStyle.downColor": "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
        }
      });
      
      widgetRef.current = widget;
    } catch (error) {
      console.error("Failed to initialize TradingView widget:", error);
    }

    return () => {
      try {
        if (container && container.innerHTML) {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        }
      } catch (error) {
        // Silently fail
      }
      widgetRef.current = null;
    };
  }, [tvLoaded, selectedSymbol.tvSymbol]);

  // Load market data and AI signal
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch market data
        const data = await apiFetch<MarketData>(`/api/market-data?symbol=${selectedSymbol.id}&timeframe=1m&limit=1`);
        if (mounted) setMarketData(data);

        // Fetch AI signal
        const signalData = await apiFetch<Signal>(`/api/fused/latest?symbol=${selectedSymbol.id}&limit=1`);
        if (mounted) setSignal(signalData);
        
      } catch (error) {
        console.error("Failed to load market data:", error);
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
  }, [selectedSymbol.id]);

  const generateRealAISignal = useCallback(async () => {
    try {
      setRegenerating(true);
      
      const marketResponse = await apiFetch<MarketData>(`/api/market-data?symbol=${selectedSymbol.id}&timeframe=1h&limit=100`);
      
      const aiResponse = await apiFetch<{ success: boolean; signal: any }>("/api/ai/generate-signal", {
        method: "POST",
        body: {
          marketData: marketResponse,
          symbol: selectedSymbol.id,
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
    } finally {
      setRegenerating(false);
    }
  }, [selectedSymbol.id]);

  const signalBadge = signal ? (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={`${
          signal.direction === "buy"
            ? "bg-success-green/20 border-success-green/50 text-success-green"
            : signal.direction === "sell"
            ? "bg-warning-red/20 border-warning-red/50 text-warning-red"
            : "bg-secondary border-secondary text-secondary-foreground"
        } text-xs font-semibold`}
      >
        {signal.direction === "buy" ? (
          <TrendingUp className="h-3 w-3 mr-1" />
        ) : signal.direction === "sell" ? (
          <TrendingDown className="h-3 w-3 mr-1" />
        ) : (
          <AlertCircle className="h-3 w-3 mr-1" />
        )}
        {signal.direction.toUpperCase()}
      </Badge>
      <Badge
        variant="outline"
        className="border-primary/50 bg-primary/20 text-xs font-semibold text-primary"
      >
        Confidence: {(signal.confidence * 100).toFixed(0)}%
      </Badge>
    </div>
  ) : null;

  return (
    <>
      <Script
        src="https://s3.tradingview.com/tv.js"
        strategy="lazyOnload"
        onLoad={() => setTvLoaded(true)}
      />
      
      <div className="space-y-4">
        {/* Symbol Selector */}
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Select Trading Instrument</CardTitle>
          </CardHeader>
          <CardContent>
            <SymbolSelector
              selectedSymbol={selectedSymbol.id}
              onSymbolChange={setSelectedSymbol}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Main Chart */}
          <div className="xl:col-span-9">
            <Card className="border-border bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold">{selectedSymbol.displayName}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedSymbol.category.toUpperCase()} • Real-time TradingView
                    </p>
                  </div>
                  {marketData && (
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="secondary" className="flex items-center gap-1 bg-success-green/20 text-success-green border-success-green/40">
                        <Activity className="h-3 w-3" />
                        LIVE
                      </Badge>
                      <span className="text-2xl font-bold text-primary">
                        ${marketData.current.price.toFixed(selectedSymbol.precision)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {signalBadge}
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  id="tradingview_chart"
                  ref={chartContainerRef}
                  className="w-full rounded-lg overflow-hidden border border-border"
                  style={{ height: "600px" }}
                >
                  {!tvLoaded && (
                    <div className="flex h-full items-center justify-center bg-background-secondary">
                      <div className="text-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading TradingView Chart...</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {marketData && (
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <div className="flex gap-6">
                      <span className="text-muted-foreground">
                        Bid: <span className="font-semibold text-warning-red">{marketData.current.bid.toFixed(selectedSymbol.precision)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Ask: <span className="font-semibold text-success-green">{marketData.current.ask.toFixed(selectedSymbol.precision)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Spread: <span className="font-semibold text-foreground">{(marketData.current.ask - marketData.current.bid).toFixed(selectedSymbol.precision)}</span>
                      </span>
                    </div>
                    <span className="text-primary text-xs">
                      Last updated: {new Date(marketData.current.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Signal Panel */}
          <div className="xl:col-span-3 space-y-4">
            <Card className="border-border bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent-purple/20 p-2">
                    <BrainCircuit className="h-5 w-5 text-accent-purple" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">AI Signal</CardTitle>
                    <p className="text-xs text-muted-foreground">OpenAI Analysis</p>
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
              <CardContent className="pt-4 space-y-4">
                {loading && (
                  <div className="text-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Generating signal...</p>
                  </div>
                )}
                {!loading && signal && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">Direction</span>
                        <Badge className={`${
                          signal.direction === "buy"
                            ? "bg-success-green text-white"
                            : signal.direction === "sell"
                            ? "bg-warning-red text-white"
                            : "bg-secondary text-secondary-foreground"
                        } font-bold`}>
                          {signal.direction.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">Confidence</span>
                        <span className="text-sm font-bold text-primary">{(signal.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">Score</span>
                        <span className="text-sm font-bold text-foreground">{signal.score.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {signal.rationale && (
                      <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
                        <h4 className="text-xs font-semibold text-primary mb-2">Analysis</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {signal.rationale}
                        </p>
                      </div>
                    )}

                    {marketData && (
                      <div className="space-y-2 pt-4 border-t border-border">
                        <h4 className="text-xs font-semibold text-foreground mb-3">Trade Setup</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md bg-background-tertiary p-2">
                            <p className="text-muted-foreground mb-1">Entry</p>
                            <p className="font-bold text-foreground">${marketData.current.price.toFixed(selectedSymbol.precision)}</p>
                          </div>
                          <div className="rounded-md bg-background-tertiary p-2">
                            <p className="text-muted-foreground mb-1">Position</p>
                            <p className="font-bold text-foreground">0.1 lots</p>
                          </div>
                          <div className="rounded-md bg-success-green/10 border border-success-green/30 p-2">
                            <p className="text-muted-foreground mb-1">TP</p>
                            <p className="font-bold text-success-green">
                              ${signal.direction === "buy" 
                                ? (marketData.current.price + 10).toFixed(selectedSymbol.precision)
                                : (marketData.current.price - 10).toFixed(selectedSymbol.precision)
                              }
                            </p>
                          </div>
                          <div className="rounded-md bg-warning-red/10 border border-warning-red/30 p-2">
                            <p className="text-muted-foreground mb-1">SL</p>
                            <p className="font-bold text-warning-red">
                              ${signal.direction === "buy"
                                ? (marketData.current.price - 4).toFixed(selectedSymbol.precision)
                                : (marketData.current.price + 4).toFixed(selectedSymbol.precision)
                              }
                            </p>
                          </div>
                        </div>
                        <div className="rounded-md bg-primary/10 border border-primary/30 p-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Risk:Reward</span>
                            <span className="text-xs font-bold text-primary">1:2.5</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {!loading && !signal && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Click refresh to generate AI signal</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}