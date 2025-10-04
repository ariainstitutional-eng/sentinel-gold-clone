"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Coins, DollarSign, Landmark } from "lucide-react";

export interface Symbol {
  id: string;
  displayName: string;
  category: "forex" | "crypto" | "stocks" | "metals";
  tvSymbol: string;
  precision: number;
}

export const SYMBOLS: Symbol[] = [
  // Forex
  { id: "XAUUSD", displayName: "Gold / USD", category: "forex", tvSymbol: "OANDA:XAUUSD", precision: 2 },
  { id: "EURUSD", displayName: "EUR / USD", category: "forex", tvSymbol: "FX:EURUSD", precision: 5 },
  { id: "GBPUSD", displayName: "GBP / USD", category: "forex", tvSymbol: "FX:GBPUSD", precision: 5 },
  { id: "USDJPY", displayName: "USD / JPY", category: "forex", tvSymbol: "FX:USDJPY", precision: 3 },
  { id: "AUDUSD", displayName: "AUD / USD", category: "forex", tvSymbol: "FX:AUDUSD", precision: 5 },
  
  // Crypto
  { id: "BTCUSD", displayName: "Bitcoin", category: "crypto", tvSymbol: "COINBASE:BTCUSD", precision: 2 },
  { id: "ETHUSD", displayName: "Ethereum", category: "crypto", tvSymbol: "COINBASE:ETHUSD", precision: 2 },
  { id: "BNBUSD", displayName: "Binance Coin", category: "crypto", tvSymbol: "BINANCE:BNBUSD", precision: 2 },
  { id: "SOLUSD", displayName: "Solana", category: "crypto", tvSymbol: "COINBASE:SOLUSD", precision: 2 },
  { id: "XRPUSD", displayName: "Ripple", category: "crypto", tvSymbol: "COINBASE:XRPUSD", precision: 4 },
  
  // Stocks
  { id: "AAPL", displayName: "Apple Inc.", category: "stocks", tvSymbol: "NASDAQ:AAPL", precision: 2 },
  { id: "MSFT", displayName: "Microsoft", category: "stocks", tvSymbol: "NASDAQ:MSFT", precision: 2 },
  { id: "GOOGL", displayName: "Alphabet", category: "stocks", tvSymbol: "NASDAQ:GOOGL", precision: 2 },
  { id: "AMZN", displayName: "Amazon", category: "stocks", tvSymbol: "NASDAQ:AMZN", precision: 2 },
  { id: "TSLA", displayName: "Tesla", category: "stocks", tvSymbol: "NASDAQ:TSLA", precision: 2 },
  
  // Metals
  { id: "XAGUSD", displayName: "Silver / USD", category: "metals", tvSymbol: "OANDA:XAGUSD", precision: 3 },
  { id: "XPTUSD", displayName: "Platinum / USD", category: "metals", tvSymbol: "OANDA:XPTUSD", precision: 2 },
  { id: "XPDUSD", displayName: "Palladium / USD", category: "metals", tvSymbol: "OANDA:XPDUSD", precision: 2 },
];

const CATEGORIES = [
  { id: "forex", label: "Forex", icon: DollarSign, color: "text-gold-primary" },
  { id: "crypto", label: "Crypto", icon: Coins, color: "text-accent-purple" },
  { id: "stocks", label: "Stocks", icon: TrendingUp, color: "text-success-green" },
  { id: "metals", label: "Metals", icon: Landmark, color: "text-gold-secondary" },
] as const;

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: Symbol) => void;
}

export function SymbolSelector({ selectedSymbol, onSymbolChange }: SymbolSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>("forex");

  const filteredSymbols = SYMBOLS.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
              className={`${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {cat.label}
            </Button>
          );
        })}
      </div>

      {/* Symbol Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {filteredSymbols.map((symbol) => (
          <Button
            key={symbol.id}
            variant={selectedSymbol === symbol.id ? "default" : "outline"}
            size="sm"
            onClick={() => onSymbolChange(symbol)}
            className={`flex flex-col items-start h-auto py-3 px-3 ${
              selectedSymbol === symbol.id
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-secondary hover:border-primary/50"
            }`}
          >
            <span className="font-bold text-sm">{symbol.id}</span>
            <span className="text-xs opacity-80 font-normal truncate w-full text-left">
              {symbol.displayName}
            </span>
            {selectedSymbol === symbol.id && (
              <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0.5">
                Active
              </Badge>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}