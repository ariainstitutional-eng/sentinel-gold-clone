"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, TrendingUp, DollarSign, Percent, AlertTriangle } from "lucide-react";
import { SYMBOLS, type Symbol } from "./symbol-selector";
import { toast } from "sonner";

interface PositionData {
  symbol: string;
  symbolName: string;
  category: string;
  exposure: number;
  pnl: number;
  percentage: number;
  risk: "low" | "medium" | "high";
}

export function PortfolioDiversification() {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalExposure, setTotalExposure] = useState(0);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      const response = await fetch("/api/positions");
      if (!response.ok) throw new Error("Failed to fetch positions");
      
      const data = await response.json();
      
      // Process positions by symbol
      const positionMap = new Map<string, { exposure: number; pnl: number }>();
      let total = 0;
      
      data.forEach((pos: any) => {
        const exposure = Math.abs(pos.volume || 0) * (pos.openPrice || 0);
        const pnl = pos.profit || 0;
        total += exposure;
        
        if (positionMap.has(pos.symbol)) {
          const existing = positionMap.get(pos.symbol)!;
          existing.exposure += exposure;
          existing.pnl += pnl;
        } else {
          positionMap.set(pos.symbol, { exposure, pnl });
        }
      });
      
      setTotalExposure(total);
      
      // Convert to position data array
      const positionsArray: PositionData[] = Array.from(positionMap.entries()).map(([symbol, data]) => {
        const symbolData = SYMBOLS.find(s => s.id === symbol) || SYMBOLS[0];
        const percentage = total > 0 ? (data.exposure / total) * 100 : 0;
        
        // Determine risk level based on exposure percentage
        let risk: "low" | "medium" | "high" = "low";
        if (percentage > 40) risk = "high";
        else if (percentage > 25) risk = "medium";
        
        return {
          symbol,
          symbolName: symbolData.displayName,
          category: symbolData.category,
          exposure: data.exposure,
          pnl: data.pnl,
          percentage,
          risk,
        };
      });
      
      // Sort by exposure descending
      positionsArray.sort((a, b) => b.exposure - a.exposure);
      
      setPositions(positionsArray);
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      toast.error("Failed to load portfolio data");
      // Generate mock data for demonstration
      generateMockPositions();
    } finally {
      setLoading(false);
    }
  };

  const generateMockPositions = () => {
    const mockPositions: PositionData[] = [
      {
        symbol: "XAUUSD",
        symbolName: "Gold/USD",
        category: "forex",
        exposure: 50000,
        pnl: 1250,
        percentage: 35,
        risk: "medium",
      },
      {
        symbol: "BTCUSD",
        symbolName: "Bitcoin",
        category: "crypto",
        exposure: 30000,
        pnl: -450,
        percentage: 21,
        risk: "low",
      },
      {
        symbol: "EURUSD",
        symbolName: "EUR/USD",
        category: "forex",
        exposure: 25000,
        pnl: 680,
        percentage: 17.5,
        risk: "low",
      },
      {
        symbol: "AAPL",
        symbolName: "Apple Inc.",
        category: "stocks",
        exposure: 20000,
        pnl: 320,
        percentage: 14,
        risk: "low",
      },
      {
        symbol: "XAGUSD",
        symbolName: "Silver/USD",
        category: "metals",
        exposure: 17500,
        pnl: -120,
        percentage: 12.5,
        risk: "low",
      },
    ];
    setPositions(mockPositions);
    setTotalExposure(142500);
  };

  // Calculate category distribution
  const categoryDistribution = positions.reduce((acc, pos) => {
    acc[pos.category] = (acc[pos.category] || 0) + pos.percentage;
    return acc;
  }, {} as Record<string, number>);

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const highRiskCount = positions.filter(p => p.risk === "high").length;

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <PieChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Portfolio Diversification</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Risk distribution across symbols</p>
            </div>
          </div>
          {highRiskCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {highRiskCount} High Risk
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Portfolio Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-background-secondary p-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Exposure</p>
            </div>
            <p className="text-xl font-bold text-foreground">${totalExposure.toLocaleString()}</p>
          </div>
          
          <div className="rounded-lg border border-border bg-background-secondary p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total P&L</p>
            </div>
            <p className={`text-xl font-bold ${totalPnL >= 0 ? "text-success-green" : "text-warning-red"}`}>
              ${totalPnL.toFixed(2)}
            </p>
          </div>
          
          <div className="rounded-lg border border-border bg-background-secondary p-3">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Positions</p>
            </div>
            <p className="text-xl font-bold text-foreground">{positions.length}</p>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Asset Category Breakdown</h4>
          <div className="space-y-2">
            {Object.entries(categoryDistribution).map(([category, percentage]) => (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground capitalize">{category}</span>
                  <span className="text-xs font-bold text-primary">{percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-background-tertiary overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Individual Positions */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Position Breakdown</h4>
          
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          )}
          
          {!loading && positions.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No open positions
            </div>
          )}
          
          {!loading && positions.map((position, index) => (
            <div 
              key={index}
              className="rounded-lg border border-border bg-background-secondary p-3 hover:bg-background-tertiary transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-foreground">{position.symbolName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{position.category}</p>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    position.risk === "high" 
                      ? "bg-warning-red/20 border-warning-red/50 text-warning-red"
                      : position.risk === "medium"
                      ? "bg-gold-primary/20 border-gold-primary/50 text-gold-primary"
                      : "bg-success-green/20 border-success-green/50 text-success-green"
                  }
                >
                  {position.risk.toUpperCase()} RISK
                </Badge>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                <div>
                  <p className="text-muted-foreground mb-1">Exposure</p>
                  <p className="font-semibold text-foreground">${position.exposure.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">P&L</p>
                  <p className={`font-semibold ${position.pnl >= 0 ? "text-success-green" : "text-warning-red"}`}>
                    ${position.pnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Portfolio %</p>
                  <p className="font-semibold text-primary">{position.percentage.toFixed(1)}%</p>
                </div>
              </div>
              
              <div className="h-1.5 rounded-full bg-background-tertiary overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    position.risk === "high" ? "bg-warning-red" :
                    position.risk === "medium" ? "bg-gold-primary" :
                    "bg-success-green"
                  }`}
                  style={{ width: `${position.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Risk Warning */}
        {highRiskCount > 0 && (
          <div className="rounded-lg border-2 border-warning-red/30 bg-warning-red/10 p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-red flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning-red">Concentration Risk Detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                {highRiskCount} position{highRiskCount > 1 ? 's' : ''} exceed 40% portfolio allocation. Consider rebalancing to reduce risk.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}