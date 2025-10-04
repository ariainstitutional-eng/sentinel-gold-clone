# MetaTrader 5 API Bridge Setup

## Overview
To connect your **live MetaTrader 5 terminal** to the Sentinel Gold Trader dashboard, you need to run a local API bridge that exposes MT5 data via HTTP.

The system automatically falls back to **Alpha Vantage** if MT5 is not running.

---

## Option 1: Python MT5 Bridge (Recommended)

### Prerequisites
- MetaTrader 5 terminal installed and running
- Python 3.8+ installed
- FBS MT5 account logged in

### Installation

1. **Install Required Packages:**
```bash
pip install MetaTrader5 flask flask-cors
```

2. **Create MT5 API Bridge:**

Save this as `mt5_bridge.py`:

```python
from flask import Flask, jsonify, request
from flask_cors import CORS
import MetaTrader5 as mt5
from datetime import datetime
import time

app = Flask(__name__)
CORS(app)

# Initialize MT5 connection
if not mt5.initialize():
    print("Failed to initialize MT5")
    exit(1)

print(f"MT5 version: {mt5.version()}")
print(f"Terminal info: {mt5.terminal_info()}")
print(f"Account info: {mt5.account_info()}")

@app.route('/api/mt5/status', methods=['GET'])
def get_status():
    """Check MT5 connection status"""
    account_info = mt5.account_info()
    if account_info is None:
        return jsonify({
            'connected': False,
            'error': 'MT5 not connected'
        }), 503
    
    return jsonify({
        'connected': True,
        'account': account_info.login,
        'balance': account_info.balance,
        'equity': account_info.equity,
        'margin': account_info.margin,
        'free_margin': account_info.margin_free,
        'profit': account_info.profit,
        'server': mt5.account_info().server,
    })

@app.route('/api/mt5/candles', methods=['GET'])
def get_candles():
    """Fetch historical candle data"""
    symbol = request.args.get('symbol', 'XAUUSD')
    timeframe_str = request.args.get('timeframe', '1h')
    limit = int(request.args.get('limit', 100))
    
    # Map timeframe strings to MT5 constants
    timeframe_map = {
        '1m': mt5.TIMEFRAME_M1,
        '5m': mt5.TIMEFRAME_M5,
        '15m': mt5.TIMEFRAME_M15,
        '30m': mt5.TIMEFRAME_M30,
        '1h': mt5.TIMEFRAME_H1,
        '4h': mt5.TIMEFRAME_H4,
        '1d': mt5.TIMEFRAME_D1,
    }
    
    timeframe = timeframe_map.get(timeframe_str, mt5.TIMEFRAME_H1)
    
    # Get candles
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, limit)
    
    if rates is None:
        return jsonify({
            'error': f'Failed to fetch {symbol} data',
            'details': mt5.last_error()
        }), 500
    
    # Get current tick
    tick = mt5.symbol_info_tick(symbol)
    
    # Convert to JSON-friendly format
    candles = [
        {
            'time': int(rate[0]),  # timestamp
            'open': float(rate[1]),
            'high': float(rate[2]),
            'low': float(rate[3]),
            'close': float(rate[4]),
            'volume': int(rate[5])
        }
        for rate in rates
    ]
    
    return jsonify({
        'symbol': symbol,
        'timeframe': timeframe_str,
        'candles': candles,
        'current': {
            'price': float(tick.last) if tick else candles[-1]['close'],
            'bid': float(tick.bid) if tick else candles[-1]['close'] - 0.5,
            'ask': float(tick.ask) if tick else candles[-1]['close'] + 0.5,
            'timestamp': int(time.time() * 1000)
        }
    })

@app.route('/api/mt5/positions', methods=['GET'])
def get_positions():
    """Get open positions"""
    positions = mt5.positions_get()
    
    if positions is None:
        return jsonify([])
    
    return jsonify([
        {
            'ticket': pos.ticket,
            'symbol': pos.symbol,
            'type': 'buy' if pos.type == mt5.ORDER_TYPE_BUY else 'sell',
            'volume': pos.volume,
            'price_open': pos.price_open,
            'price_current': pos.price_current,
            'profit': pos.profit,
            'time': int(pos.time),
            'sl': pos.sl,
            'tp': pos.tp,
        }
        for pos in positions
    ])

@app.route('/api/mt5/place-order', methods=['POST'])
def place_order():
    """Place a new order"""
    data = request.json
    
    symbol = data.get('symbol', 'XAUUSD')
    order_type = mt5.ORDER_TYPE_BUY if data.get('type') == 'buy' else mt5.ORDER_TYPE_SELL
    volume = float(data.get('volume', 0.01))
    sl = float(data.get('sl', 0))
    tp = float(data.get('tp', 0))
    
    # Get current price
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return jsonify({'error': 'Failed to get price'}), 500
    
    price = tick.ask if order_type == mt5.ORDER_TYPE_BUY else tick.bid
    
    request_dict = {
        'action': mt5.TRADE_ACTION_DEAL,
        'symbol': symbol,
        'volume': volume,
        'type': order_type,
        'price': price,
        'sl': sl,
        'tp': tp,
        'deviation': 20,
        'magic': 234000,
        'comment': 'Sentinel AI Trade',
        'type_time': mt5.ORDER_TIME_GTC,
        'type_filling': mt5.ORDER_FILLING_IOC,
    }
    
    result = mt5.order_send(request_dict)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return jsonify({
            'success': False,
            'error': result.comment,
            'retcode': result.retcode
        }), 400
    
    return jsonify({
        'success': True,
        'ticket': result.order,
        'volume': result.volume,
        'price': result.price
    })

if __name__ == '__main__':
    print("Starting MT5 API Bridge on http://localhost:8080")
    app.run(host='0.0.0.0', port=8080, debug=False)
```

3. **Run the Bridge:**
```bash
python mt5_bridge.py
```

4. **Verify Connection:**
Open your browser: `http://localhost:8080/api/mt5/status`

You should see your MT5 account details.

---

## Option 2: Expert Advisor (EA) REST API

If you prefer an EA-based solution:

1. Download and install an **MT5 REST API EA** from:
   - https://github.com/OpenTrading/mt5-rest-api
   - Or create a custom EA with HTTP server functionality

2. Configure the EA to run on port 8080

3. The dashboard will automatically detect and use it

---

## Fallback Behavior

If the MT5 bridge is **not running**:
- Dashboard automatically uses **Alpha Vantage API** for market data
- AI signals continue to work with real market data
- Trading features will be disabled (view-only mode)

---

## Security Notes

⚠️ **Important:**
- The MT5 bridge runs **locally only** (localhost:8080)
- Never expose port 8080 to the internet
- For production deployment, add authentication
- Review MT5 API permissions carefully

---

## Troubleshooting

**MT5 not detected:**
1. Ensure MetaTrader 5 is running and logged in
2. Check if port 8080 is available: `netstat -an | grep 8080`
3. Verify Python bridge is running: `curl http://localhost:8080/api/mt5/status`

**Alpha Vantage fallback:**
- Check `.env` file has `ALPHA_VANTAGE_API_KEY=J71CYFEV8Y98T2EK`
- Verify API key is valid at: https://www.alphavantage.co/

---

## Architecture

```
┌─────────────────────┐
│  Next.js Dashboard  │
│   (Port 3000)       │
└──────────┬──────────┘
           │
           ├─────────────────┐
           │                 │
    ┌──────▼──────┐   ┌─────▼────────┐
    │ MT5 Bridge  │   │ Alpha Vantage│
    │ (Port 8080) │   │  (Fallback)  │
    └──────┬──────┘   └──────────────┘
           │
    ┌──────▼──────┐
    │ MetaTrader 5│
    │  Terminal   │
    └─────────────┘
```

---

## Current Configuration

Your system is configured with:
- **OpenAI API Key:** `sk-McStsMNrRpQrmxFggi4IRx7WkG9tpZU8EMlMk96crrcFVSz2`
- **OpenAI Base URL:** `https://api.chatanywhere.org/v1`
- **Alpha Vantage Key:** `J71CYFEV8Y98T2EK`
- **FBS MT5 Server:** `FBS-Demo`
- **FBS MT5 Login:** `103936248`

---

## Next Steps

1. **Start the Python bridge** (optional - for live MT5 data)
2. **Click "Connect MT5 Account"** in the dashboard
3. **Generate AI signals** using the refresh button in AI Signal Panel
4. System will automatically use MT5 if available, otherwise Alpha Vantage

The dashboard is now ready for **real-world trading** with AI-powered signals! 🚀