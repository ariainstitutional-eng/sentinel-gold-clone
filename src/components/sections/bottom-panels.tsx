"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FolderKanban,
  Loader2,
  Network,
  Newspaper,
  Plug,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SystemMetrics } from "./system-metrics";

type Sentiment = "BULLISH" | "BEARISH" | "NEUTRAL";
type Priority = "HIGH" | "MEDIUM" | "LOW";

const SentimentIndicator = ({ sentiment }: { sentiment: Sentiment }) => {
  const sentimentConfig = {
    BULLISH: { icon: TrendingUp, color: "text-success-green" },
    BEARISH: { icon: TrendingDown, color: "text-warning-red" },
    NEUTRAL: { icon: Minus, color: "text-muted-foreground" },
  } as const;
  const { icon: Icon, color } = sentimentConfig[sentiment];
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {sentiment}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const priorityConfig = {
    HIGH: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    MEDIUM: "bg-gold-primary text-primary-foreground hover:bg-gold-primary/90",
    LOW: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  } as const;
  return <Badge className={`${priorityConfig[priority]}`}>{priority}</Badge>;
};

interface Account {
  id: number;
  broker: string;
  server: string;
  login: string;
  status: "connected" | "disconnected";
  balance: number;
  equity: number;
}

interface NewsItem {
  id: number;
  publishedAt: number;
  source: string;
  title: string;
  url: string | null;
  priority: "high" | "medium" | "low";
  sentiment: "bullish" | "bearish" | "neutral";
  summary: string | null;
}

export default function BottomPanels() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsFilter, setNewsFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [loading, setLoading] = useState({ accounts: true, news: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadAccounts = async () => {
      try {
        const data = await apiFetch<Account[]>("/api/accounts?limit=10");
        if (mounted) setAccounts(data);
      } catch (error) {
        console.error("Failed to load accounts:", error);
        if (mounted) setAccounts([]);
      } finally {
        if (mounted) setLoading((s) => ({ ...s, accounts: false }));
      }
    };
    const loadNews = async () => {
      try {
        const qs = newsFilter === "all" ? "" : `?priority=${newsFilter}`;
        const data = await apiFetch<NewsItem[]>(`/api/news${qs}`);
        if (mounted) setNews(data);
      } catch (error) {
        console.error("Failed to load news:", error);
        if (mounted) setNews([]);
      } finally {
        if (mounted) setLoading((s) => ({ ...s, news: false }));
      }
    };
    loadAccounts();
    loadNews();
    const i = setInterval(loadNews, 60000);
    return () => {
      mounted = false;
      clearInterval(i);
    };
  }, [newsFilter]);

  const connectMT5 = useCallback(async () => {
    try {
      setBusy(true);
      
      // Try to connect to MT5 session
      const connectionResponse = await apiFetch<any>("/api/mt5/connect", {
        method: "POST",
        body: {}
      });
      
      if (connectionResponse.success) {
        // MT5 connected successfully or using Alpha Vantage fallback
        await apiFetch<Account>("/api/accounts", {
          method: "POST",
          body: {
            broker: "FBS",
            server: connectionResponse.data?.server || "FBS-Demo",
            login: connectionResponse.data?.login || "103936248",
            alias: connectionResponse.connection === "mt5" ? "MT5 Live Session" : "MT5 Demo (Alpha Vantage)",
            balance: 0,
            equity: 0,
            status: connectionResponse.connection === "mt5" ? "connected" : "disconnected",
          },
        });
        
        const refreshed = await apiFetch<Account[]>("/api/accounts?limit=10");
        setAccounts(refreshed);
      }
    } catch (error) {
      console.error("MT5 connection failed:", error);
    } finally {
      setBusy(false);
    }
  }, []);

  const liveAccount = useMemo(() => (accounts || []).find((a) => a.status === "connected"), [accounts]);

  const sentimentCounts = useMemo(() => {
    const items = news || [];
    return items.reduce(
      (acc, n) => {
        if (n.sentiment === "bullish") acc.bullish++;
        else if (n.sentiment === "bearish") acc.bearish++;
        else acc.neutral++;
        return acc;
      },
      { bullish: 0, bearish: 0, neutral: 0 }
    );
  }, [news]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* System Metrics Panel */}
      <SystemMetrics />

      {/* Account Status Panel */}
      <Card className="lg:col-span-3 bg-card h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Account Status</CardTitle>
                <CardDescription className="text-sm">{loading.accounts ? "Loading..." : liveAccount ? `${liveAccount.broker} • ${liveAccount.server}` : "No account connected"}</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={`border-success-green/50 bg-success-green/10 text-success-green text-xs font-medium px-2 py-0.5 ${liveAccount ? "" : "opacity-50"}`}>
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success-green"></span>
              </span>
              {liveAccount ? "LIVE" : "OFF"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="h-full flex flex-col items-center justify-center pt-8 pb-16 text-center">
          <Network className="h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{liveAccount ? `${liveAccount.login}` : "No trading account connected"}</p>
          <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={connectMT5} disabled={busy}>
            <Plug className="mr-2 h-4 w-4" />
            {busy ? "Connecting..." : liveAccount ? "Reconnect" : "Connect MT5 Account"}
          </Button>
        </CardContent>
      </Card>

      {/* Market News Panel */}
      <Card className="lg:col-span-6 bg-card flex flex-col h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Newspaper className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Market News</CardTitle>
                <CardDescription className="text-sm">Real-time sentiment analysis</CardDescription>
              </div>
            </div>
            <ToggleGroup type="single" value={newsFilter} onValueChange={(v) => v && setNewsFilter(v as any)} className="h-8">
              <ToggleGroupItem value="all" aria-label="Toggle all" className="px-2.5 py-1 text-xs data-[state=on]:bg-background">All</ToggleGroupItem>
              <ToggleGroupItem value="high" aria-label="Toggle high" className="px-2.5 py-1 text-xs data-[state=on]:bg-background">High</ToggleGroupItem>
              <ToggleGroupItem value="medium" aria-label="Toggle medium" className="px-2.5 py-1 text-xs data-[state=on]:bg-background">Medium</ToggleGroupItem>
              <ToggleGroupItem value="low" aria-label="Toggle low" className="px-2.5 py-1 text-xs data-[state=on]:bg-background">Low</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-4 pr-2 -mr-2 overflow-y-auto">
          {loading.news && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading news...</div>
          )}
          {!loading.news && news && news.length === 0 && (
            <p className="text-sm text-muted-foreground">No news available.</p>
          )}
          {!loading.news && news && news.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PriorityBadge priority={item.priority.toUpperCase() as Priority} />
                  <SentimentIndicator sentiment={(item.sentiment.toUpperCase() as Sentiment)} />
                </div>
                <small className="text-xs text-muted-foreground">{new Date(item.publishedAt * 1000).toLocaleString()}</small>
              </div>
              <h4 className="font-semibold text-foreground leading-tight">{item.title}</h4>
              {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Source: {item.source}</span>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span />
                )}
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter className="mt-auto p-4">
          <div className="bg-background-tertiary p-4 rounded-lg w-full">
            <h4 className="text-sm font-semibold text-foreground mb-3">Market Sentiment</h4>
            <div className="flex justify-around items-center text-center">
              <div>
                <div className="text-lg font-bold text-success-green">{sentimentCounts.bullish}</div>
                <div className="text-xs text-muted-foreground">Bullish</div>
              </div>
              <div>
                <div className="text-lg font-bold text-warning-red">{sentimentCounts.bearish}</div>
                <div className="text-xs text-muted-foreground">Bearish</div>
              </div>
              <div>
                <div className="text-lg font-bold text-muted-foreground">{sentimentCounts.neutral}</div>
                <div className="text-xs text-muted-foreground">Neutral</div>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}