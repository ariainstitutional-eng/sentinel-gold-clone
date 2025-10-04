/**
 * MT5 Bridge API
 * Connects to Python MT5 system via python-shell
 */

import { NextRequest, NextResponse } from 'next/server';
import { PythonShell } from 'python-shell';
import path from 'path';

interface MT5BridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Execute Python MT5 command
 */
async function executeMT5Command(command: string, args: any = {}): Promise<MT5BridgeResponse> {
  return new Promise((resolve) => {
    const options = {
      mode: 'json' as const,
      pythonPath: 'python',
      scriptPath: path.join(process.cwd()),
      args: [command, JSON.stringify(args)],
    };

    PythonShell.run('mt5_trading_system.py', options, (err, results) => {
      if (err) {
        resolve({
          success: false,
          error: err.message,
        });
      } else {
        resolve({
          success: true,
          data: results?.[0] || null,
        });
      }
    });
  });
}

/**
 * GET: Get MT5 account info
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'account_info';

    let result: MT5BridgeResponse;

    switch (action) {
      case 'account_info':
        result = await executeMT5Command('get_account_info');
        break;

      case 'positions':
        const symbol = searchParams.get('symbol');
        result = await executeMT5Command('get_positions', { symbol });
        break;

      case 'live_price':
        const priceSymbol = searchParams.get('symbol') || 'XAUUSD';
        result = await executeMT5Command('get_live_price', { symbol: priceSymbol });
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('MT5 Bridge GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST: Execute MT5 trades
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    let result: MT5BridgeResponse;

    switch (action) {
      case 'open_position':
        result = await executeMT5Command('open_position', params);
        break;

      case 'close_position':
        result = await executeMT5Command('close_position', params);
        break;

      case 'modify_position':
        result = await executeMT5Command('modify_position', params);
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('MT5 Bridge POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}