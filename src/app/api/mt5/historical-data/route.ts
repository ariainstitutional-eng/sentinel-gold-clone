import { NextRequest, NextResponse } from "next/server";

/**
 * MT5 Historical Data Ingestion API
 * Fetches historical OHLCV data for AI training
 * 
 * Query Parameters:
 * - symbol: Trading symbol (e.g., XAUUSD)
 * - timeframe: M1, M5, M15, M30, H1, H4, D1
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - limit: Max number of bars (default: 10000)
 */

interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread?: number;
}

interface MT5HistoricalResponse {
  success: boolean;
  symbol: string;
  timeframe: string;
  bars: OHLCVBar[];
  count: number;
  from: string;
  to: string;
  error?: string;
}

// Timeframe mapping for MT5
const TIMEFRAME_MAP: Record<string, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H4: 240,
  D1: 1440,
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol") || "XAUUSD";
    const timeframe = searchParams.get("timeframe") || "M5";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") || "10000");

    // Validate timeframe
    if (!TIMEFRAME_MAP[timeframe]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid timeframe. Valid options: ${Object.keys(TIMEFRAME_MAP).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Calculate date range
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days

    // Call MT5 Python bridge for real historical data
    const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || "http://localhost:8000";
    
    try {
      const response = await fetch(
        `${MT5_BRIDGE_URL}/historical-data?symbol=${symbol}&timeframe=${timeframe}&from=${fromDate.toISOString()}&to=${toDate.toISOString()}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000), // 10s timeout
        }
      );

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          symbol,
          timeframe,
          bars: data.bars || [],
          count: data.bars?.length || 0,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        });
      } else {
        const errorText = await response.text();
        throw new Error(`MT5 bridge returned ${response.status}: ${errorText}`);
      }
    } catch (bridgeError) {
      console.error("MT5 bridge error:", bridgeError);
      return NextResponse.json(
        {
          success: false,
          error: `MT5 bridge unavailable: ${bridgeError instanceof Error ? bridgeError.message : String(bridgeError)}. Please ensure MT5 Python bridge is running at ${MT5_BRIDGE_URL}`,
          code: "MT5_BRIDGE_UNAVAILABLE"
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("MT5 historical data error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch historical data",
      },
      { status: 500 }
    );
  }
}