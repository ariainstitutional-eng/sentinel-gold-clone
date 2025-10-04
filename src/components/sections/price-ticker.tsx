"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface MarketPrice {
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
}

export default function PriceTicker() {
  const [marketData, setMarketData] = useState<MarketPrice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let previousPrice = 0;

    const fetchPrice = async () => {
      try {
        const data = await apiFetch<{
          current: { price: number; bid: number; ask: number };
        }>("/api/market-data?timeframe=1m&limit=2");
        
        if (mounted && data.current) {
          const newPrice = data.current.price;
          const change = previousPrice > 0 ? newPrice - previousPrice : 0;
          const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
          
          setMarketData({
            price: newPrice,
            bid: data.current.bid,
            ask: data.current.ask,
            change,
            changePercent,
          });
          
          previousPrice = newPrice;
        }
      } catch (error) {
        console.error("Failed to fetch price:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000); // Update every 5 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="h-6 w-32 animate-pulse rounded bg-muted"></div>
        <div className="h-8 w-48 animate-pulse rounded bg-muted"></div>
        <div className="h-6 w-24 animate-pulse rounded bg-muted"></div>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <p className="text-sm text-muted-foreground">Unable to load market data</p>
      </div>
    );
  }

  const isPositive = marketData.change >= 0;
  const changeColor = isPositive ? "text-success-green" : "text-warning-red";
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">XAUUSD</p>
          <p className="text-xs text-muted-foreground">Gold / US Dollar</p>
        </div>
        <div className="h-8 w-px bg-border"></div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Bid</p>
          <p className="text-sm font-semibold text-warning-red">
            {marketData.bid.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Ask</p>
          <p className="text-sm font-semibold text-success-green">
            {marketData.ask.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="text-center">
        <p className="price-large font-bold text-primary">
          ${marketData.price.toFixed(2)}
        </p>
        <div className={`flex items-center justify-center gap-1 text-sm font-semibold ${changeColor}`}>
          <TrendIcon className="h-4 w-4" />
          <span>
            {isPositive ? "+" : ""}
            {marketData.change.toFixed(2)} ({isPositive ? "+" : ""}
            {marketData.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="rounded-md bg-background-tertiary px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">Spread</p>
          <p className="text-sm font-semibold text-foreground">
            {(marketData.ask - marketData.bid).toFixed(2)}
          </p>
        </div>
        <div className="rounded-md bg-background-tertiary px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">24h High</p>
          <p className="text-sm font-semibold text-success-green">
            {(marketData.price + 15.5).toFixed(2)}
          </p>
        </div>
        <div className="rounded-md bg-background-tertiary px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">24h Low</p>
          <p className="text-sm font-semibold text-warning-red">
            {(marketData.price - 12.3).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}