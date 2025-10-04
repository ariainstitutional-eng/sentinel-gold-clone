import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ai/generate-signal
 * Generate REAL AI trading signals using OpenAI
 * Uses market data and technical indicators to produce actual ML-based signals
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      marketData, 
      symbol = "XAUUSD",
      timeframe = "1h",
      strategy = "Conservative Trend"
    } = body;

    // Validate OpenAI configuration
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    if (!apiKey) {
      return NextResponse.json({
        error: "OpenAI API key not configured"
      }, { status: 500 });
    }

    if (!marketData || !marketData.candles || marketData.candles.length === 0) {
      return NextResponse.json({
        error: "Market data required for signal generation"
      }, { status: 400 });
    }

    // Calculate technical indicators
    const technicalAnalysis = calculateTechnicalIndicators(marketData.candles);
    
    // Prepare market context for AI
    const marketContext = prepareMarketContext(marketData, technicalAnalysis, symbol);

    // Call OpenAI for signal generation
    const aiResponse = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert forex/gold trading AI specializing in ${symbol} technical analysis. 
You use ${strategy} strategy to generate high-probability trade signals.
Analyze the provided market data and technical indicators to produce:
1. Direction (BUY/SELL/NEUTRAL)
2. Confidence (0-100%)
3. Entry price
4. Take Profit level
5. Stop Loss level
6. Risk/Reward ratio

Respond ONLY with valid JSON in this exact format:
{
  "direction": "BUY|SELL|NEUTRAL",
  "confidence": 0.00,
  "entry": 0.00,
  "takeProfit": 0.00,
  "stopLoss": 0.00,
  "riskReward": "1:2.0",
  "reasoning": "Brief explanation"
}`
          },
          {
            role: "user",
            content: marketContext
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error:", errorText);
      return NextResponse.json({
        error: "AI signal generation failed",
        details: errorText
      }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    
    if (!aiData.choices || aiData.choices.length === 0) {
      throw new Error("No response from AI model");
    }

    const aiMessage = aiData.choices[0].message.content;
    
    // Parse AI response
    let signal;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiMessage.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, aiMessage];
      signal = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiMessage);
      throw new Error("Invalid AI response format");
    }

    // Validate signal structure
    if (!signal.direction || !signal.confidence) {
      throw new Error("Incomplete signal from AI");
    }

    // Add metadata
    const enrichedSignal = {
      ...signal,
      symbol,
      timeframe,
      strategy,
      timestamp: Date.now(),
      source: "OpenAI GPT-4o-mini",
      technicalData: {
        rsi: technicalAnalysis.rsi,
        macd: technicalAnalysis.macd,
        trend: technicalAnalysis.trend,
        volatility: technicalAnalysis.volatility
      },
      currentPrice: marketData.current?.price || marketData.candles[marketData.candles.length - 1].close
    };

    return NextResponse.json({
      success: true,
      signal: enrichedSignal
    });

  } catch (error) {
    console.error("AI signal generation error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Signal generation failed"
    }, { status: 500 });
  }
}

function calculateTechnicalIndicators(candles: any[]) {
  // Calculate RSI (14 period)
  const rsi = calculateRSI(candles, 14);
  
  // Calculate MACD
  const macd = calculateMACD(candles);
  
  // Determine trend
  const sma20 = calculateSMA(candles, 20);
  const sma50 = calculateSMA(candles, 50);
  const trend = sma20 > sma50 ? "BULLISH" : "BEARISH";
  
  // Calculate volatility
  const volatility = calculateVolatility(candles, 20);

  return {
    rsi: rsi.toFixed(2),
    macd: {
      value: macd.value.toFixed(2),
      signal: macd.signal.toFixed(2),
      histogram: macd.histogram.toFixed(2)
    },
    trend,
    volatility: volatility.toFixed(2),
    sma20: sma20.toFixed(2),
    sma50: sma50.toFixed(2)
  };
}

function calculateRSI(candles: any[], period: number = 14): number {
  if (candles.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(candles: any[]) {
  const ema12 = calculateEMA(candles, 12);
  const ema26 = calculateEMA(candles, 26);
  const macdValue = ema12 - ema26;
  const signal = ema26; // Simplified signal line
  const histogram = macdValue - signal;

  return {
    value: macdValue,
    signal: signal,
    histogram: histogram
  };
}

function calculateSMA(candles: any[], period: number): number {
  if (candles.length < period) return candles[candles.length - 1].close;
  
  const slice = candles.slice(-period);
  const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
  return sum / period;
}

function calculateEMA(candles: any[], period: number): number {
  if (candles.length < period) return candles[candles.length - 1].close;
  
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(candles.slice(0, period), period);
  
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
  }
  
  return ema;
}

function calculateVolatility(candles: any[], period: number): number {
  if (candles.length < period) return 0;
  
  const slice = candles.slice(-period);
  const returns = slice.map((candle, i) => {
    if (i === 0) return 0;
    return (candle.close - slice[i - 1].close) / slice[i - 1].close;
  });
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance) * 100;
}

function prepareMarketContext(marketData: any, technical: any, symbol: string): string {
  const latest = marketData.candles[marketData.candles.length - 1];
  const current = marketData.current || latest;
  
  return `
Symbol: ${symbol}
Current Price: ${current.close || current.price}
Bid/Ask: ${current.bid} / ${current.ask}

Recent Price Action (last 5 candles):
${marketData.candles.slice(-5).map((c: any, i: number) => 
  `${i + 1}. O: ${c.open} H: ${c.high} L: ${c.low} C: ${c.close} Vol: ${c.volume}`
).join('\n')}

Technical Indicators:
- RSI(14): ${technical.rsi}
- MACD: ${technical.macd.value} (Signal: ${technical.macd.signal}, Histogram: ${technical.macd.histogram})
- SMA(20): ${technical.sma20}
- SMA(50): ${technical.sma50}
- Trend: ${technical.trend}
- Volatility: ${technical.volatility}%

Based on this data, provide a trading signal with entry, TP, SL, and confidence level.
`;
}