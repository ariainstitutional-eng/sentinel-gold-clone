<initial_code>
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

</initial_code>

<edited_code>
# Sentinel Gold Trader

**AI-Powered XAUUSD Scalping System with Real-Time Risk Management**

A production-ready, professional trading dashboard that combines advanced AI signal generation with comprehensive risk management for gold (XAUUSD) trading.

## 🚀 Features

### Core Trading System
- **Three-Layer AI Fusion**: Primary, Sequential, and Contextual signal analysis
- **Real-Time Chart Visualization**: Interactive price charts with multiple timeframes (M1-D1)
- **Live Risk Monitoring**: Dynamic drawdown and loss tracking with automated safeguards
- **MT5 Integration**: Direct broker connectivity for live trading
- **Market News Feed**: Real-time sentiment analysis from multiple sources

### Risk Management
- **Capital Protection**: Automatically enforced risk limits
- **Position Sizing**: Dynamic lot calculation based on account equity
- **Drawdown Monitoring**: Real-time tracking with visual indicators
- **Emergency Stop**: Instant system halt for critical situations
- **Daily Loss Limits**: Configurable thresholds to protect capital

### System Monitoring
- **Live Performance Metrics**: CPU, memory, and uptime tracking
- **System Health Dashboard**: Real-time status of all components
- **Audit Logging**: Comprehensive activity tracking
- **Database Integration**: Full persistence layer with Turso

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React, TypeScript
- **UI Components**: Shadcn/UI, Tailwind CSS, Recharts
- **Database**: Turso (SQLite), Drizzle ORM
- **API**: RESTful endpoints with Zod validation
- **Notifications**: Sonner toast system

## 📊 Database Schema

### Core Tables
- `models` - AI model configurations and versions
- `signals` - Individual layer signals (primary/sequential/contextual)
- `fusedSignals` - Three-layer fusion output
- `positions` - Open and closed trading positions
- `orders` - Order management and execution
- `accounts` - MT5 broker accounts
- `riskLimits` - Dynamic risk parameters
- `newsItems` - Market news with sentiment analysis
- `auditLogs` - Comprehensive system activity logs
- `systemStatus` - Real-time system health metrics

## 🔌 API Endpoints

### Trading
- `GET /api/positions` - Retrieve positions (open/closed)
- `POST /api/positions` - Create new position
- `PUT /api/positions` - Update position
- `GET /api/orders` - View order history
- `POST /api/orders/submit` - Submit new order

### AI & Signals
- `GET /api/signals` - Individual layer signals
- `POST /api/signals` - Create new signal
- `GET /api/fused/latest` - Latest fused signal
- `GET /api/models` - AI model list
- `PATCH /api/models/[id]/status` - Update model status

### Risk & System
- `GET /api/risk` - Current risk limits
- `PATCH /api/risk` - Update risk parameters
- `POST /api/risk/position-size` - Calculate position size
- `GET /api/system/status` - System health
- `POST /api/system/toggle` - Toggle AI/risk systems

### Data Management
- `GET /api/accounts` - MT5 account list
- `POST /api/accounts` - Connect new account
- `GET /api/news` - Market news feed
- `POST /api/news/scrape` - Trigger news scraping

## 🎯 Key Components

### Main Dashboard
- **TradingChart**: Real-time XAUUSD price visualization with Recharts
- **AISignalPanel**: Latest fused signal display
- **AIModelControl**: Model selection and retraining interface

### Risk Monitor
- Real-time drawdown calculation from open positions
- Dynamic risk level assessment (LOW/MEDIUM/HIGH)
- Interactive risk reduction controls
- Emergency stop functionality

### Bottom Panels
- **SystemMetrics**: CPU, memory, uptime monitoring
- **AccountStatus**: MT5 connection management
- **MarketNews**: Sentiment-analyzed news feed with filters

### Header
- System status badges (MT5, AI, Risk Monitor)
- Real-time connection indicators
- Professional branding

## 🔐 Production Readiness

### Data Validation
- All API endpoints use Zod schemas
- Comprehensive error handling
- Type-safe database operations

### Performance
- Efficient data fetching with caching
- Optimized chart rendering
- Real-time updates without blocking UI

### User Experience
- Loading states for all async operations
- Toast notifications for user feedback
- Error boundaries for graceful failures
- Responsive design for all screen sizes

### Security
- Query parameter sanitization
- SQL injection prevention via ORM
- Bearer token authentication ready
- Input validation on all endpoints

## 🚦 Getting Started

### Prerequisites
```bash
Node.js 18+ or Bun
Turso database account
```

### Installation
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Turso credentials to .env

# Run database migrations
npm run db:push

# Seed initial data (optional)
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables
```
TURSO_DATABASE_URL=your_turso_url
TURSO_AUTH_TOKEN=your_turso_token
```

## 📈 Usage

1. **Connect MT5 Account**: Click "Connect MT5 Account" to establish broker connection
2. **Activate AI System**: Toggle AI activation to start signal generation
3. **Monitor Risk**: View real-time risk metrics and adjust as needed
4. **Review Signals**: Check AI fusion signals before trading
5. **Manage Positions**: Track open positions and P&L
6. **Stay Informed**: Monitor market news and sentiment

## 🔧 Configuration

### Risk Parameters
Edit via `/api/risk` endpoint or Risk Monitor UI:
- `maxDailyLoss` - Maximum daily loss limit ($)
- `maxDrawdownPct` - Maximum drawdown percentage (%)
- `maxRiskPerTradePct` - Risk per trade (%)
- `maxConcurrentPositions` - Max open positions

### AI Models
Manage via AI Model Control panel:
- Switch between trained models
- Trigger retraining cycles
- Monitor model performance

## 📝 Database Management

Access your database through the Database Studio tab (top right of the page) to:
- View all tables and records
- Execute custom queries
- Monitor data in real-time
- Manage schemas and migrations

## 🤝 Support

For issues or questions:
1. Check API endpoint documentation
2. Review error logs in console
3. Verify database connection
4. Check system status indicators

## 📄 License

This project is proprietary software for professional trading use.

---

**Built with Lovable** - AI-powered development platform
</edited_code>