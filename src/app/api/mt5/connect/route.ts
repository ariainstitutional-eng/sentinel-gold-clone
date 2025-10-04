import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/mt5/connect
 * Attempts to connect to MT5 terminal session
 * Falls back to Alpha Vantage if MT5 connection fails
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { login, server } = body;

    // Configuration from environment
    const mt5Login = login || process.env.FBS_MT5_LOGIN;
    const mt5Server = server || process.env.FBS_MT5_SERVER;

    if (!mt5Login || !mt5Server) {
      return NextResponse.json({
        success: false,
        error: "Missing MT5 credentials",
        fallback: "alpha_vantage"
      }, { status: 400 });
    }

    // Try to detect if MT5 terminal is running
    // This would require MT5's Expert Advisor (EA) or API gateway running locally
    // For now, we'll check if there's a local MT5 API endpoint
    
    try {
      // Attempt connection to local MT5 WebSocket/REST API
      // This assumes you have MetaTrader5 Python package or EA REST API running
      const mt5Response = await fetch("http://localhost:8080/api/mt5/status", {
        method: "GET",
        signal: AbortSignal.timeout(3000)
      });

      if (mt5Response.ok) {
        const mt5Data = await mt5Response.json();
        
        return NextResponse.json({
          success: true,
          connection: "mt5",
          data: {
            login: mt5Login,
            server: mt5Server,
            connected: true,
            terminal: mt5Data
          }
        });
      }
    } catch (mt5Error) {
      console.log("MT5 terminal not detected, falling back to Alpha Vantage");
    }

    // Fallback to Alpha Vantage for market data
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!alphaVantageKey) {
      return NextResponse.json({
        success: false,
        error: "No market data source available",
        note: "MT5 not running and no Alpha Vantage API key configured"
      }, { status: 500 });
    }

    // Test Alpha Vantage connection
    const avResponse = await fetch(
      `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${alphaVantageKey}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!avResponse.ok) {
      throw new Error("Alpha Vantage connection failed");
    }

    const avData = await avResponse.json();
    
    if (avData["Realtime Currency Exchange Rate"]) {
      const rate = avData["Realtime Currency Exchange Rate"];
      
      return NextResponse.json({
        success: true,
        connection: "alpha_vantage",
        data: {
          login: mt5Login,
          server: mt5Server,
          connected: false,
          fallback: true,
          currentPrice: parseFloat(rate["5. Exchange Rate"]),
          lastUpdate: rate["6. Last Refreshed"]
        },
        note: "MT5 terminal not detected. Using Alpha Vantage for market data."
      });
    }

    return NextResponse.json({
      success: false,
      error: "Unable to establish market data connection"
    }, { status: 500 });

  } catch (error) {
    console.error("MT5 connection error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
      fallback: "alpha_vantage"
    }, { status: 500 });
  }
}

/**
 * GET /api/mt5/connect
 * Check current MT5 connection status
 */
export async function GET() {
  try {
    // Check if MT5 terminal is accessible
    try {
      const mt5Response = await fetch("http://localhost:8080/api/mt5/status", {
        method: "GET",
        signal: AbortSignal.timeout(2000)
      });

      if (mt5Response.ok) {
        const data = await mt5Response.json();
        return NextResponse.json({
          connected: true,
          connection: "mt5",
          terminal: data
        });
      }
    } catch (error) {
      // MT5 not accessible
    }

    // Check Alpha Vantage fallback
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (alphaVantageKey) {
      return NextResponse.json({
        connected: false,
        connection: "alpha_vantage",
        fallback: true,
        note: "MT5 terminal not detected. Alpha Vantage available for market data."
      });
    }

    return NextResponse.json({
      connected: false,
      connection: "none",
      error: "No market data source available"
    });

  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}