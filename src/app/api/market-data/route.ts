import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/market-data
 * Fetches REAL gold price data - tries MT5 first, falls back to Alpha Vantage
 * Query params:
 * - timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" (default: "1d")
 * - limit: number of candles to return (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get("timeframe") || "1d";
    const limit = parseInt(searchParams.get("limit") || "100");

    // PRIORITY 1: Try MT5 connection first
    try {
      const mt5Data = await fetchFromMT5(timeframe, limit);
      if (mt5Data) return mt5Data;
    } catch (error) {
      console.log("MT5 not available, trying Alpha Vantage...");
    }

    // PRIORITY 2: Try Alpha Vantage
    try {
      const alphaVantageData = await fetchFromAlphaVantage(timeframe, limit);
      if (alphaVantageData) return alphaVantageData;
    } catch (error) {
      console.error("Alpha Vantage failed:", error);
    }

    // PRIORITY 3: Try Finnhub
    try {
      const finnhubData = await fetchFromFinnhub(timeframe, limit);
      if (finnhubData) return finnhubData;
    } catch (error) {
      console.error("Finnhub failed:", error);
    }

    // PRIORITY 4: Try Polygon
    try {
      const polygonData = await fetchFromPolygon(timeframe, limit);
      if (polygonData) return polygonData;
    } catch (error) {
      console.error("Polygon failed:", error);
    }

    // No real data source available - return error
    return NextResponse.json(
      { 
        error: "No real market data source available",
        note: "All data sources failed. Please ensure MT5 is running or configure API keys: ALPHA_VANTAGE_API_KEY, FINNHUB_API_KEY, POLYGON_API_KEY"
      },
      { status: 503 }
    );

  } catch (error) {
    console.error("Market data API error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to fetch market data"
      },
      { status: 500 }
    );
  }
}

async function fetchFromMT5(timeframe: string, limit: number) {
  try {
    const response = await fetch(`http://localhost:8080/api/mt5/candles?symbol=XAUUSD&timeframe=${timeframe}&limit=${limit}`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) throw new Error("MT5 API not responding");

    const data = await response.json();
    
    if (!data.candles || data.candles.length === 0) {
      throw new Error("No MT5 data available");
    }

    return NextResponse.json({
      symbol: "XAUUSD",
      timeframe,
      candles: data.candles,
      current: data.current,
      source: "MetaTrader 5 (Live Session)",
    });
  } catch (error) {
    throw error;
  }
}

async function fetchFromAlphaVantage(timeframe: string, limit: number) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("No Alpha Vantage API key");

  let functionName: string;
  let interval: string | undefined;

  if (["1m", "5m", "15m", "30m", "1h"].includes(timeframe)) {
    functionName = "FX_INTRADAY";
    interval = timeframe === "1h" ? "60min" : timeframe.replace("m", "min");
  } else {
    functionName = "FX_DAILY";
  }

  const url = functionName === "FX_INTRADAY"
    ? `https://www.alphavantage.co/query?function=${functionName}&from_symbol=XAU&to_symbol=USD&interval=${interval}&apikey=${apiKey}&outputsize=full`
    : `https://www.alphavantage.co/query?function=${functionName}&from_symbol=XAU&to_symbol=USD&apikey=${apiKey}&outputsize=full`;

  const response = await fetch(url, { 
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) throw new Error("Alpha Vantage API failed");

  const data = await response.json();

  if (data["Error Message"] || data["Note"]) {
    throw new Error(data["Error Message"] || data["Note"]);
  }

  const timeSeriesKey = Object.keys(data).find(key => key.includes("Time Series"));
  if (!timeSeriesKey) throw new Error("No time series data from Alpha Vantage");

  const timeSeries = data[timeSeriesKey];
  const timestamps = Object.keys(timeSeries).slice(0, limit);

  const candles = timestamps.map(timestamp => {
    const candle = timeSeries[timestamp];
    return {
      time: Math.floor(new Date(timestamp).getTime() / 1000),
      open: parseFloat(candle["1. open"]),
      high: parseFloat(candle["2. high"]),
      low: parseFloat(candle["3. low"]),
      close: parseFloat(candle["4. close"]),
      volume: 0
    };
  }).reverse();

  const currentPrice = candles[candles.length - 1]?.close || 0;

  return NextResponse.json({
    symbol: "XAUUSD",
    timeframe,
    candles,
    current: {
      price: currentPrice,
      bid: currentPrice - 0.5,
      ask: currentPrice + 0.5,
      timestamp: Date.now(),
    },
    source: "Alpha Vantage (Real Market Data)",
  });
}

async function fetchFromFinnhub(timeframe: string, limit: number) {
  const apiKey = process.env.FINNHUB_API_KEY || "demo";
  
  const resolution = getResolution(timeframe);
  const to = Math.floor(Date.now() / 1000);
  const from = to - (limit * getSecondsPerCandle(timeframe));
  
  const url = `https://finnhub.io/api/v1/forex/candle?symbol=OANDA:XAU_USD&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
  
  const response = await fetch(url, { 
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000) 
  });
  
  if (!response.ok) throw new Error("Finnhub API failed");
  
  const data = await response.json();
  
  if (data.s !== "ok" || !data.c) {
    throw new Error("No data from Finnhub");
  }

  const candles = data.t.map((timestamp: number, i: number) => ({
    time: timestamp,
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v[i] || 0,
  }));

  const currentPrice = candles[candles.length - 1]?.close || 0;

  return NextResponse.json({
    symbol: "XAUUSD",
    timeframe,
    candles,
    current: {
      price: currentPrice,
      bid: currentPrice - 0.5,
      ask: currentPrice + 0.5,
      timestamp: Date.now(),
    },
    source: "Finnhub (Real Market Data)",
  });
}

async function fetchFromPolygon(timeframe: string, limit: number) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("No Polygon API key");

  const multiplier = getPolygonMultiplier(timeframe);
  const timespan = getPolygonTimespan(timeframe);
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - limit * getSecondsPerCandle(timeframe) * 1000).toISOString().split('T')[0];
  
  const url = `https://api.polygon.io/v2/aggs/ticker/C:XAUUSD/range/${multiplier}/${timespan}/${from}/${to}?apiKey=${apiKey}`;
  
  const response = await fetch(url, { 
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000)
  });
  
  if (!response.ok) throw new Error("Polygon API failed");
  
  const data = await response.json();
  
  if (!data.results) throw new Error("No data from Polygon");

  const candles = data.results.map((item: any) => ({
    time: Math.floor(item.t / 1000),
    open: item.o,
    high: item.h,
    low: item.l,
    close: item.c,
    volume: item.v || 0,
  }));

  const currentPrice = candles[candles.length - 1]?.close || 0;

  return NextResponse.json({
    symbol: "XAUUSD",
    timeframe,
    candles,
    current: {
      price: currentPrice,
      bid: currentPrice - 0.5,
      ask: currentPrice + 0.5,
      timestamp: Date.now(),
    },
    source: "Polygon.io (Real Market Data)",
  });
}

function getSecondsPerCandle(timeframe: string): number {
  const map: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
  };
  return map[timeframe] || 86400;
}

function getResolution(timeframe: string): string {
  const map: Record<string, string> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "4h": "240",
    "1d": "D",
  };
  return map[timeframe] || "D";
}

function getPolygonMultiplier(timeframe: string): number {
  const map: Record<string, number> = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 1,
    "4h": 4,
    "1d": 1,
  };
  return map[timeframe] || 1;
}

function getPolygonTimespan(timeframe: string): string {
  const map: Record<string, string> = {
    "1m": "minute",
    "5m": "minute",
    "15m": "minute",
    "30m": "minute",
    "1h": "hour",
    "4h": "hour",
    "1d": "day",
  };
  return map[timeframe] || "day";
}