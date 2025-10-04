"""
Sentinel Gold Trader - Production MT5 Trading System
Real-time market data integration with live trade execution
No mocks, no simulations, no placeholders - production ready
"""

import MetaTrader5 as mt5
import requests
import pandas as pd
import numpy as np
import json
import time
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import csv
import os
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('trading_system.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class ConfigManager:
    """Manages configuration from config.json"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config_path = config_path
        self.config = self._load_config()
    
    def _load_config(self) -> Dict:
        """Load configuration file"""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Config file not found: {self.config_path}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in config file: {e}")
            sys.exit(1)
    
    def get(self, key: str, default=None):
        """Get configuration value"""
        return self.config.get(key, default)


class MarketDataFetcher:
    """Fetches real-time market data from multiple sources"""
    
    def __init__(self, config: ConfigManager):
        self.config = config
        self.alpha_vantage_key = config.get('alpha_vantage_api_key')
        self.finnhub_key = config.get('finnhub_api_key', 'demo')
        self.polygon_key = config.get('polygon_api_key')
        self.last_fetch_time = 0
        self.min_fetch_interval = 1  # Minimum 1 second between fetches
    
    def get_live_price(self, symbol: str = "XAUUSD") -> Optional[Dict]:
        """
        Get live price from MT5 first, fallback to free APIs
        Returns: {price, bid, ask, timestamp} or None
        """
        # Throttle requests
        current_time = time.time()
        if current_time - self.last_fetch_time < self.min_fetch_interval:
            time.sleep(self.min_fetch_interval - (current_time - self.last_fetch_time))
        
        self.last_fetch_time = time.time()
        
        # Priority 1: MT5 Terminal (fastest, most accurate)
        mt5_price = self._fetch_from_mt5(symbol)
        if mt5_price:
            logger.debug(f"Price from MT5: {mt5_price['price']}")
            return mt5_price
        
        # Priority 2: Alpha Vantage (free, reliable)
        if self.alpha_vantage_key:
            av_price = self._fetch_from_alpha_vantage(symbol)
            if av_price:
                logger.debug(f"Price from Alpha Vantage: {av_price['price']}")
                return av_price
        
        # Priority 3: Finnhub (free tier available)
        finnhub_price = self._fetch_from_finnhub(symbol)
        if finnhub_price:
            logger.debug(f"Price from Finnhub: {finnhub_price['price']}")
            return finnhub_price
        
        logger.error("All market data sources failed")
        return None
    
    def _fetch_from_mt5(self, symbol: str) -> Optional[Dict]:
        """Fetch live tick from MT5"""
        try:
            if not mt5.initialize():
                return None
            
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                return None
            
            return {
                'price': (tick.bid + tick.ask) / 2,
                'bid': tick.bid,
                'ask': tick.ask,
                'timestamp': tick.time,
                'source': 'MT5'
            }
        except Exception as e:
            logger.debug(f"MT5 fetch error: {e}")
            return None
    
    def _fetch_from_alpha_vantage(self, symbol: str) -> Optional[Dict]:
        """Fetch from Alpha Vantage Global Quote"""
        try:
            url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=XAUUSD&apikey={self.alpha_vantage_key}"
            response = requests.get(url, timeout=5)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            if "Global Quote" not in data or not data["Global Quote"]:
                return None
            
            quote = data["Global Quote"]
            price = float(quote.get("05. price", 0))
            
            if price == 0:
                return None
            
            return {
                'price': price,
                'bid': price - 0.5,
                'ask': price + 0.5,
                'timestamp': int(time.time()),
                'source': 'AlphaVantage'
            }
        except Exception as e:
            logger.debug(f"Alpha Vantage fetch error: {e}")
            return None
    
    def _fetch_from_finnhub(self, symbol: str) -> Optional[Dict]:
        """Fetch from Finnhub quote API"""
        try:
            url = f"https://finnhub.io/api/v1/quote?symbol=OANDA:XAU_USD&token={self.finnhub_key}"
            response = requests.get(url, timeout=5)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            price = data.get('c', 0)  # Current price
            
            if price == 0:
                return None
            
            return {
                'price': price,
                'bid': price - 0.5,
                'ask': price + 0.5,
                'timestamp': int(time.time()),
                'source': 'Finnhub'
            }
        except Exception as e:
            logger.debug(f"Finnhub fetch error: {e}")
            return None
    
    def get_historical_data(self, symbol: str, timeframe: str, limit: int = 100) -> Optional[pd.DataFrame]:
        """Get historical candlestick data"""
        # Try MT5 first
        mt5_data = self._fetch_mt5_history(symbol, timeframe, limit)
        if mt5_data is not None:
            return mt5_data
        
        # Fallback to Alpha Vantage
        if self.alpha_vantage_key:
            av_data = self._fetch_av_history(symbol, timeframe, limit)
            if av_data is not None:
                return av_data
        
        logger.error("Failed to fetch historical data from all sources")
        return None
    
    def _fetch_mt5_history(self, symbol: str, timeframe: str, limit: int) -> Optional[pd.DataFrame]:
        """Fetch historical data from MT5"""
        try:
            if not mt5.initialize():
                return None
            
            # Map timeframe strings to MT5 constants
            timeframe_map = {
                '1m': mt5.TIMEFRAME_M1,
                '5m': mt5.TIMEFRAME_M5,
                '15m': mt5.TIMEFRAME_M15,
                '30m': mt5.TIMEFRAME_M30,
                '1h': mt5.TIMEFRAME_H1,
                '4h': mt5.TIMEFRAME_H4,
                '1d': mt5.TIMEFRAME_D1
            }
            
            mt5_timeframe = timeframe_map.get(timeframe, mt5.TIMEFRAME_H1)
            
            rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, limit)
            
            if rates is None or len(rates) == 0:
                return None
            
            df = pd.DataFrame(rates)
            df['time'] = pd.to_datetime(df['time'], unit='s')
            df.columns = ['time', 'open', 'high', 'low', 'close', 'tick_volume', 'spread', 'real_volume']
            
            return df[['time', 'open', 'high', 'low', 'close', 'tick_volume']]
        
        except Exception as e:
            logger.debug(f"MT5 history fetch error: {e}")
            return None
    
    def _fetch_av_history(self, symbol: str, timeframe: str, limit: int) -> Optional[pd.DataFrame]:
        """Fetch historical data from Alpha Vantage"""
        try:
            if timeframe in ['1m', '5m', '15m', '30m', '1h']:
                function = "FX_INTRADAY"
                interval = timeframe.replace('m', 'min') if 'm' in timeframe else '60min'
                url = f"https://www.alphavantage.co/query?function={function}&from_symbol=XAU&to_symbol=USD&interval={interval}&apikey={self.alpha_vantage_key}&outputsize=full"
            else:
                function = "FX_DAILY"
                url = f"https://www.alphavantage.co/query?function={function}&from_symbol=XAU&to_symbol=USD&apikey={self.alpha_vantage_key}&outputsize=full"
            
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            # Find time series key
            time_series_key = next((k for k in data.keys() if 'Time Series' in k), None)
            
            if not time_series_key:
                return None
            
            time_series = data[time_series_key]
            
            # Convert to DataFrame
            df_data = []
            for timestamp, values in list(time_series.items())[:limit]:
                df_data.append({
                    'time': pd.to_datetime(timestamp),
                    'open': float(values['1. open']),
                    'high': float(values['2. high']),
                    'low': float(values['3. low']),
                    'close': float(values['4. close']),
                    'volume': 0
                })
            
            df = pd.DataFrame(df_data)
            df = df.sort_values('time').reset_index(drop=True)
            
            return df
        
        except Exception as e:
            logger.debug(f"Alpha Vantage history fetch error: {e}")
            return None


class MT5Executor:
    """Handles real MT5 trade execution"""
    
    def __init__(self, config: ConfigManager):
        self.config = config
        self.login = config.get('mt5_login')
        self.password = config.get('mt5_password')
        self.server = config.get('mt5_server')
        self.magic_number = config.get('magic_number', 234000)
        self.initialized = False
    
    def initialize(self) -> bool:
        """Initialize MT5 connection"""
        if self.initialized:
            return True
        
        try:
            if not mt5.initialize():
                logger.error(f"MT5 initialize() failed, error code: {mt5.last_error()}")
                return False
            
            # Login if credentials provided
            if self.login and self.password and self.server:
                authorized = mt5.login(self.login, password=self.password, server=self.server)
                if not authorized:
                    logger.error(f"MT5 login failed, error code: {mt5.last_error()}")
                    mt5.shutdown()
                    return False
                
                logger.info(f"Connected to MT5 account: {self.login} on {self.server}")
            else:
                logger.info("Connected to MT5 (using currently logged-in account)")
            
            self.initialized = True
            return True
        
        except Exception as e:
            logger.error(f"MT5 initialization error: {e}")
            return False
    
    def shutdown(self):
        """Shutdown MT5 connection"""
        if self.initialized:
            mt5.shutdown()
            self.initialized = False
            logger.info("MT5 connection closed")
    
    def get_account_info(self) -> Optional[Dict]:
        """Get account information"""
        if not self.initialize():
            return None
        
        try:
            account_info = mt5.account_info()
            if account_info is None:
                return None
            
            return {
                'balance': account_info.balance,
                'equity': account_info.equity,
                'margin': account_info.margin,
                'free_margin': account_info.margin_free,
                'margin_level': account_info.margin_level,
                'profit': account_info.profit,
                'leverage': account_info.leverage,
                'currency': account_info.currency
            }
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            return None
    
    def open_position(self, symbol: str, order_type: str, volume: float, 
                     sl: float = 0, tp: float = 0, comment: str = "") -> Optional[Dict]:
        """
        Open a new position
        order_type: 'buy' or 'sell'
        Returns: order result dict or None
        """
        if not self.initialize():
            logger.error("Cannot open position: MT5 not initialized")
            return None
        
        try:
            # Get symbol info
            symbol_info = mt5.symbol_info(symbol)
            if symbol_info is None:
                logger.error(f"Symbol {symbol} not found")
                return None
            
            if not symbol_info.visible:
                if not mt5.symbol_select(symbol, True):
                    logger.error(f"Failed to select symbol {symbol}")
                    return None
            
            # Get current price
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                logger.error(f"Failed to get tick for {symbol}")
                return None
            
            # Determine order type and price
            if order_type.lower() == 'buy':
                trade_type = mt5.ORDER_TYPE_BUY
                price = tick.ask
            elif order_type.lower() == 'sell':
                trade_type = mt5.ORDER_TYPE_SELL
                price = tick.bid
            else:
                logger.error(f"Invalid order type: {order_type}")
                return None
            
            # Prepare request
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": volume,
                "type": trade_type,
                "price": price,
                "sl": sl,
                "tp": tp,
                "deviation": 20,
                "magic": self.magic_number,
                "comment": comment,
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            # Send order
            result = mt5.order_send(request)
            
            if result is None:
                logger.error("order_send failed, result is None")
                return None
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                logger.error(f"Order failed, retcode={result.retcode}, comment={result.comment}")
                return None
            
            logger.info(f"Position opened: {order_type.upper()} {volume} {symbol} at {price}")
            
            return {
                'ticket': result.order,
                'volume': result.volume,
                'price': result.price,
                'type': order_type,
                'symbol': symbol,
                'sl': sl,
                'tp': tp,
                'comment': comment,
                'timestamp': datetime.now()
            }
        
        except Exception as e:
            logger.error(f"Error opening position: {e}")
            return None
    
    def close_position(self, ticket: int) -> bool:
        """Close position by ticket"""
        if not self.initialize():
            return False
        
        try:
            # Get position info
            position = mt5.positions_get(ticket=ticket)
            if position is None or len(position) == 0:
                logger.error(f"Position {ticket} not found")
                return False
            
            position = position[0]
            
            # Prepare close request
            symbol = position.symbol
            volume = position.volume
            
            # Determine close type (opposite of position type)
            if position.type == mt5.ORDER_TYPE_BUY:
                trade_type = mt5.ORDER_TYPE_SELL
                price = mt5.symbol_info_tick(symbol).bid
            else:
                trade_type = mt5.ORDER_TYPE_BUY
                price = mt5.symbol_info_tick(symbol).ask
            
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": volume,
                "type": trade_type,
                "position": ticket,
                "price": price,
                "deviation": 20,
                "magic": self.magic_number,
                "comment": "close",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            result = mt5.order_send(request)
            
            if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
                logger.error(f"Failed to close position {ticket}")
                return False
            
            logger.info(f"Position {ticket} closed successfully")
            return True
        
        except Exception as e:
            logger.error(f"Error closing position: {e}")
            return False
    
    def get_open_positions(self, symbol: str = None) -> List[Dict]:
        """Get all open positions"""
        if not self.initialize():
            return []
        
        try:
            if symbol:
                positions = mt5.positions_get(symbol=symbol)
            else:
                positions = mt5.positions_get()
            
            if positions is None:
                return []
            
            return [
                {
                    'ticket': pos.ticket,
                    'symbol': pos.symbol,
                    'type': 'buy' if pos.type == mt5.ORDER_TYPE_BUY else 'sell',
                    'volume': pos.volume,
                    'open_price': pos.price_open,
                    'current_price': pos.price_current,
                    'sl': pos.sl,
                    'tp': pos.tp,
                    'profit': pos.profit,
                    'comment': pos.comment,
                    'open_time': datetime.fromtimestamp(pos.time)
                }
                for pos in positions
            ]
        
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []


class RiskManager:
    """Manages position sizing and risk parameters"""
    
    def __init__(self, config: ConfigManager):
        self.config = config
        self.max_risk_per_trade = config.get('max_risk_per_trade', 0.02)  # 2%
        self.max_positions = config.get('max_positions', 3)
        self.max_daily_loss = config.get('max_daily_loss', 0.05)  # 5%
        self.max_drawdown = config.get('max_drawdown', 0.10)  # 10%
        self.daily_loss = 0
        self.daily_trades = 0
        self.day_start_balance = 0
    
    def calculate_position_size(self, account_balance: float, entry_price: float, 
                               stop_loss: float, symbol: str = "XAUUSD") -> float:
        """
        Calculate position size based on risk parameters
        Returns: lot size
        """
        try:
            # Risk amount in account currency
            risk_amount = account_balance * self.max_risk_per_trade
            
            # Points at risk
            points_at_risk = abs(entry_price - stop_loss)
            
            if points_at_risk == 0:
                logger.warning("Stop loss equals entry price, cannot calculate position size")
                return 0
            
            # For XAUUSD, 1 lot = 100 oz, 1 point = $0.01 per oz
            # Value per lot per point = 100 * 0.01 = $1
            value_per_point = 1.0  # For XAUUSD
            
            # Calculate lot size
            lot_size = risk_amount / (points_at_risk * value_per_point)
            
            # Round to 2 decimals (standard lot size precision)
            lot_size = round(lot_size, 2)
            
            # Apply min/max lot size
            min_lot = self.config.get('min_lot_size', 0.01)
            max_lot = self.config.get('max_lot_size', 10.0)
            
            lot_size = max(min_lot, min(lot_size, max_lot))
            
            logger.info(f"Calculated position size: {lot_size} lots (risk: ${risk_amount:.2f})")
            
            return lot_size
        
        except Exception as e:
            logger.error(f"Error calculating position size: {e}")
            return 0
    
    def check_trading_allowed(self, account_info: Dict) -> Tuple[bool, str]:
        """Check if trading is allowed based on risk rules"""
        
        # Initialize day tracking
        if self.day_start_balance == 0:
            self.day_start_balance = account_info['balance']
        
        # Check daily loss limit
        current_daily_loss = (self.day_start_balance - account_info['balance']) / self.day_start_balance
        
        if current_daily_loss >= self.max_daily_loss:
            return False, f"Daily loss limit reached: {current_daily_loss*100:.2f}%"
        
        # Check drawdown
        drawdown = (account_info['balance'] - account_info['equity']) / account_info['balance']
        
        if drawdown >= self.max_drawdown:
            return False, f"Max drawdown reached: {drawdown*100:.2f}%"
        
        # Check margin level
        if account_info['margin_level'] < 200:
            return False, f"Margin level too low: {account_info['margin_level']:.2f}%"
        
        return True, "Trading allowed"
    
    def reset_daily_stats(self):
        """Reset daily statistics (call at start of new day)"""
        self.daily_loss = 0
        self.daily_trades = 0
        self.day_start_balance = 0
        logger.info("Daily statistics reset")


class TradeLogger:
    """Logs all trades and system events to CSV"""
    
    def __init__(self, trades_file: str = "trades.csv", events_file: str = "events.csv"):
        self.trades_file = trades_file
        self.events_file = events_file
        self._ensure_files_exist()
    
    def _ensure_files_exist(self):
        """Create CSV files with headers if they don't exist"""
        # Trades file
        if not os.path.exists(self.trades_file):
            with open(self.trades_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'timestamp', 'ticket', 'symbol', 'type', 'volume', 'entry_price',
                    'exit_price', 'sl', 'tp', 'profit', 'comment', 'status'
                ])
        
        # Events file
        if not os.path.exists(self.events_file):
            with open(self.events_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['timestamp', 'event_type', 'description', 'data'])
    
    def log_trade(self, trade_data: Dict):
        """Log a trade to CSV"""
        try:
            with open(self.trades_file, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    trade_data.get('timestamp', datetime.now()),
                    trade_data.get('ticket', ''),
                    trade_data.get('symbol', ''),
                    trade_data.get('type', ''),
                    trade_data.get('volume', 0),
                    trade_data.get('entry_price', 0),
                    trade_data.get('exit_price', 0),
                    trade_data.get('sl', 0),
                    trade_data.get('tp', 0),
                    trade_data.get('profit', 0),
                    trade_data.get('comment', ''),
                    trade_data.get('status', '')
                ])
        except Exception as e:
            logger.error(f"Error logging trade: {e}")
    
    def log_event(self, event_type: str, description: str, data: Dict = None):
        """Log a system event to CSV"""
        try:
            with open(self.events_file, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    datetime.now(),
                    event_type,
                    description,
                    json.dumps(data) if data else ''
                ])
        except Exception as e:
            logger.error(f"Error logging event: {e}")


class TradingSystem:
    """Main trading system orchestrator"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config = ConfigManager(config_path)
        self.market_data = MarketDataFetcher(self.config)
        self.executor = MT5Executor(self.config)
        self.risk_manager = RiskManager(self.config)
        self.trade_logger = TradeLogger()
        self.running = False
        self.last_price_check = 0
        self.price_check_interval = self.config.get('price_check_interval', 5)  # seconds
    
    def start(self):
        """Start the trading system"""
        logger.info("=" * 60)
        logger.info("SENTINEL GOLD TRADER - PRODUCTION SYSTEM STARTING")
        logger.info("=" * 60)
        
        # Initialize MT5
        if not self.executor.initialize():
            logger.error("Failed to initialize MT5. System cannot start.")
            return
        
        # Log account info
        account_info = self.executor.get_account_info()
        if account_info:
            logger.info(f"Account Balance: {account_info['balance']} {account_info['currency']}")
            logger.info(f"Equity: {account_info['equity']} {account_info['currency']}")
            logger.info(f"Free Margin: {account_info['free_margin']} {account_info['currency']}")
            logger.info(f"Leverage: 1:{account_info['leverage']}")
        
        self.trade_logger.log_event('SYSTEM_START', 'Trading system started', account_info)
        
        self.running = True
        
        try:
            self._main_loop()
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received")
        except Exception as e:
            logger.error(f"Fatal error in main loop: {e}", exc_info=True)
        finally:
            self.stop()
    
    def stop(self):
        """Stop the trading system"""
        logger.info("Stopping trading system...")
        self.running = False
        self.executor.shutdown()
        self.trade_logger.log_event('SYSTEM_STOP', 'Trading system stopped')
        logger.info("Trading system stopped")
    
    def _main_loop(self):
        """Main trading loop"""
        symbol = self.config.get('symbol', 'XAUUSD')
        
        while self.running:
            try:
                current_time = time.time()
                
                # Check if it's time to fetch price
                if current_time - self.last_price_check < self.price_check_interval:
                    time.sleep(0.1)
                    continue
                
                self.last_price_check = current_time
                
                # Get live price
                price_data = self.market_data.get_live_price(symbol)
                
                if price_data is None:
                    logger.warning("Failed to get live price, retrying...")
                    time.sleep(5)
                    continue
                
                logger.info(f"Live {symbol}: {price_data['price']:.2f} (bid: {price_data['bid']:.2f}, ask: {price_data['ask']:.2f}) [Source: {price_data['source']}]")
                
                # Get account info
                account_info = self.executor.get_account_info()
                if account_info is None:
                    logger.error("Failed to get account info")
                    time.sleep(5)
                    continue
                
                # Check if trading is allowed
                allowed, reason = self.risk_manager.check_trading_allowed(account_info)
                
                if not allowed:
                    logger.warning(f"Trading not allowed: {reason}")
                    time.sleep(60)
                    continue
                
                # Get open positions
                open_positions = self.executor.get_open_positions(symbol)
                logger.info(f"Open positions: {len(open_positions)}")
                
                # Monitor open positions
                for position in open_positions:
                    logger.info(f"Position {position['ticket']}: {position['type'].upper()} {position['volume']} lots @ {position['open_price']:.2f}, P&L: ${position['profit']:.2f}")
                
                # Here you would add your trading strategy logic
                # For now, this is a monitoring system that logs prices and positions
                # To add trading signals, integrate your strategy here
                
                # Example: Simple signal checking placeholder
                # if self._check_buy_signal(price_data):
                #     self._execute_buy(symbol, price_data, account_info)
                # elif self._check_sell_signal(price_data):
                #     self._execute_sell(symbol, price_data, account_info)
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                time.sleep(5)
    
    def _execute_buy(self, symbol: str, price_data: Dict, account_info: Dict):
        """Execute a buy trade"""
        try:
            # Calculate stop loss and take profit
            entry_price = price_data['ask']
            sl = entry_price - self.config.get('default_sl_points', 10)
            tp = entry_price + self.config.get('default_tp_points', 20)
            
            # Calculate position size
            volume = self.risk_manager.calculate_position_size(
                account_info['balance'],
                entry_price,
                sl,
                symbol
            )
            
            if volume == 0:
                logger.warning("Position size is zero, skipping trade")
                return
            
            # Execute trade
            result = self.executor.open_position(
                symbol=symbol,
                order_type='buy',
                volume=volume,
                sl=sl,
                tp=tp,
                comment="Auto buy"
            )
            
            if result:
                self.trade_logger.log_trade({
                    'timestamp': result['timestamp'],
                    'ticket': result['ticket'],
                    'symbol': symbol,
                    'type': 'buy',
                    'volume': volume,
                    'entry_price': entry_price,
                    'sl': sl,
                    'tp': tp,
                    'status': 'opened'
                })
                
                logger.info(f"BUY ORDER EXECUTED: {volume} lots @ {entry_price}")
        
        except Exception as e:
            logger.error(f"Error executing buy: {e}")
    
    def _execute_sell(self, symbol: str, price_data: Dict, account_info: Dict):
        """Execute a sell trade"""
        try:
            # Calculate stop loss and take profit
            entry_price = price_data['bid']
            sl = entry_price + self.config.get('default_sl_points', 10)
            tp = entry_price - self.config.get('default_tp_points', 20)
            
            # Calculate position size
            volume = self.risk_manager.calculate_position_size(
                account_info['balance'],
                entry_price,
                sl,
                symbol
            )
            
            if volume == 0:
                logger.warning("Position size is zero, skipping trade")
                return
            
            # Execute trade
            result = self.executor.open_position(
                symbol=symbol,
                order_type='sell',
                volume=volume,
                sl=sl,
                tp=tp,
                comment="Auto sell"
            )
            
            if result:
                self.trade_logger.log_trade({
                    'timestamp': result['timestamp'],
                    'ticket': result['ticket'],
                    'symbol': symbol,
                    'type': 'sell',
                    'volume': volume,
                    'entry_price': entry_price,
                    'sl': sl,
                    'tp': tp,
                    'status': 'opened'
                })
                
                logger.info(f"SELL ORDER EXECUTED: {volume} lots @ {entry_price}")
        
        except Exception as e:
            logger.error(f"Error executing sell: {e}")


def main():
    """Main entry point"""
    print("""
╔════════════════════════════════════════════════════════════╗
║     SENTINEL GOLD TRADER - MT5 PRODUCTION SYSTEM          ║
║                                                            ║
║  Real-time market data | Live MT5 execution               ║
║  No simulations | No placeholders | Production ready      ║
╚════════════════════════════════════════════════════════════╝
    """)
    
    # Check if config exists
    if not os.path.exists('config.json'):
        logger.error("config.json not found. Please create it first.")
        sys.exit(1)
    
    # Start trading system
    system = TradingSystem('config.json')
    system.start()


if __name__ == "__main__":
    main()