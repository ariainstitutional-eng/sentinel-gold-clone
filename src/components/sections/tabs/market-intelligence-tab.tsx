"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Loader2,
  AlertCircle
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

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

export function MarketIntelligenceTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsFilter, setNewsFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadNews = async () => {
      try {
        setError(null);
        const qs = newsFilter === "all" ? "" : `?priority=${newsFilter}`;
        const data = await apiFetch<NewsItem[]>(`/api/news${qs}`);
        if (mounted) setNews(data);
      } catch (error) {
        console.error("Failed to load news:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to load market news";
        if (mounted) {
          setNews([]);
          setError(errorMsg);
          toast.error(errorMsg);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    loadNews();
    const interval = setInterval(loadNews, 60000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [newsFilter]);

  const sentimentCounts = news.reduce(
    (acc, n) => {
      if (n.sentiment === "bullish") acc.bullish++;
      else if (n.sentiment === "bearish") acc.bearish++;
      else acc.neutral++;
      return acc;
    },
    { bullish: 0, bearish: 0, neutral: 0 }
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Error Banner */}
      {error && (
        <div className="lg:col-span-12 bg-warning-red/10 border border-warning-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning-red flex-shrink-0" />
          <p className="text-sm text-warning-red">{error}</p>
        </div>
      )}

      {/* Market Sentiment Overview */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Market Sentiment</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Aggregated news analysis</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-success-green/30 bg-success-green/10 p-4 text-center">
                <div className="text-3xl font-bold text-success-green">{sentimentCounts.bullish}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Bullish
                </div>
              </div>
              <div className="rounded-lg border border-warning-red/30 bg-warning-red/10 p-4 text-center">
                <div className="text-3xl font-bold text-warning-red">{sentimentCounts.bearish}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Bearish
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background-secondary p-4 text-center">
                <div className="text-3xl font-bold text-foreground">{sentimentCounts.neutral}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Minus className="h-3 w-3" />
                  Neutral
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background-secondary p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Overall Bias</h4>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Market Direction</span>
                {sentimentCounts.bullish > sentimentCounts.bearish ? (
                  <Badge className="bg-success-green text-white">BULLISH</Badge>
                ) : sentimentCounts.bearish > sentimentCounts.bullish ? (
                  <Badge className="bg-warning-red text-white">BEARISH</Badge>
                ) : (
                  <Badge className="bg-secondary text-secondary-foreground">NEUTRAL</Badge>
                )}
              </div>
              <div className="h-2 rounded-full bg-background-tertiary overflow-hidden flex">
                <div 
                  className="bg-success-green h-full transition-all"
                  style={{ width: `${(sentimentCounts.bullish / (news.length || 1)) * 100}%` }}
                />
                <div 
                  className="bg-warning-red h-full transition-all"
                  style={{ width: `${(sentimentCounts.bearish / (news.length || 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{((sentimentCounts.bullish / (news.length || 1)) * 100).toFixed(0)}% Bull</span>
                <span>{((sentimentCounts.bearish / (news.length || 1)) * 100).toFixed(0)}% Bear</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* News Feed */}
      <div className="lg:col-span-8">
        <Card className="border-border bg-card/50 backdrop-blur-sm h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Newspaper className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Market News Feed</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Real-time financial news</p>
                </div>
              </div>
              <ToggleGroup type="single" value={newsFilter} onValueChange={(v) => v && setNewsFilter(v as any)}>
                <ToggleGroupItem value="all" className="text-xs data-[state=on]:bg-background">All</ToggleGroupItem>
                <ToggleGroupItem value="high" className="text-xs data-[state=on]:bg-background">High</ToggleGroupItem>
                <ToggleGroupItem value="medium" className="text-xs data-[state=on]:bg-background">Medium</ToggleGroupItem>
                <ToggleGroupItem value="low" className="text-xs data-[state=on]:bg-background">Low</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {!loading && news.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No news available</p>
                </div>
              )}
              
              {!loading && news.map((item) => (
                <div 
                  key={item.id} 
                  className="rounded-lg border border-border bg-background-secondary p-4 hover:bg-background-tertiary transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority.toUpperCase() as Priority} />
                      <SentimentIndicator sentiment={item.sentiment.toUpperCase() as Sentiment} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.publishedAt * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <h4 className="font-semibold text-foreground leading-tight mb-2">{item.title}</h4>
                  
                  {item.summary && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.summary}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Source: <span className="font-semibold text-foreground">{item.source}</span></span>
                    {item.url && (
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        Read more <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}