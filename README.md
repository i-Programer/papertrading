# PaperTrade Terminal

> A real-time cryptocurrency paper trading simulator built with Next.js, featuring live market data, interactive charts, and AI-powered trading assistance.

## 🚀 Live Demo

[View Live Demo](https://papertrading-rho.vercel.app/)

---

## ✨ Features

### 📊 Real-time Trading

- **Live Price Updates** via WebSocket connection to Binance API
- **Interactive Candlestick Charts** with multiple timeframes (1m to 1w)
- **Technical Indicators**: MA(50), EMA(20) with real-time updates
- **Multiple Chart Presets**: 12H, 1D, 3D, 7D, 14D, 1M, 3M, 6M, 1Y, 2Y, 5Y

### 💰 Paper Trading

- **$100,000 Virtual Cash** to start trading
- **BUY/SELL Orders** with Market and Limit order types
- **Real-time Portfolio Tracking** with P&L calculations
- **Trade History** with detailed transaction logs
- **Position Management** with entry/exit tracking

### 🤖 AI-Powered Features

- **Trading Signal Analysis** with confidence scores (Gemini API)
- **Pattern Detection** for technical chart patterns
- **Smart Position Sizing** using Kelly Criterion
- **Market Sentiment Analysis** based on price action and volume
- **Volatility Alerts** for unusual market conditions
- **Chat Assistant** for trading questions and insights

### 📱 User Experience

- **Authentication** via Clerk (Google/GitHub/Email)
- **Watchlist** to track favorite cryptocurrencies
- **Responsive Design** with dark theme optimized for trading
- **Custom Scrollbars** matching the trading terminal aesthetic

### 🔒 Security & Data

- **User Profiles** stored in Supabase
- **Portfolio Persistence** across sessions
- **Guest Mode** for instant demo access
- **Secure Authentication** with Clerk
- **Server-side Validation** for all trades

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework with App Router |
| React 19 | UI library |
| TypeScript | Type safety |
| Zustand | State management |
| Tailwind CSS | Styling |
| Lightweight Charts | Candlestick visualization |
| Lucide React | Icons |

### Backend (Separate Repository)

| Technology | Purpose |
|------------|---------|
| Express.js | API server |
| Supabase | PostgreSQL database |
| Clerk | Authentication |
| Gemini AI | AI trading signals |
| WebSocket | Real-time data streaming |
| Binance API | Market data source |

### Development Tools

- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for code formatting
- **Vercel** for frontend deployment

---

## 📦 Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- [Backend server running](https://github.com/i-Programer/papertrading-api)

### Frontend Setup

#### 1. Clone the repository

```bash
git clone https://github.com/i-Programer/papertrading.git
cd papertrading 
```

#### 2. Install dependencies

```bash
npm install
# or
yarn install
```

#### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
```

#### 4. Run the development server

```bash
npm run dev
# or
yarn dev
```

#### 5. Open the application

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🔧 Backend Setup

The frontend requires a separate backend API. See the [Backend Repository](https://github.com/i-Programer/papertrading-api) for detailed setup.

### Quick Backend Setup

```bash
git clone https://github.com/i-Programer/papertrading-api.git
cd papertrading-api 
npm install
```

Create a `.env` file:

```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:3000
```

Start the backend:

```bash
npm start
# or for development with auto-reload
npm run dev
```

---

## 🗂️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── login/             # Login page
│   ├── register/          # Registration page
│   ├── portfolio/         # Portfolio page
│   ├── trade/             # Trading page
│   └── page.tsx           # Landing page
├── components/            # Reusable components
│   ├── AIPanel.tsx        # AI Trading Assistant
│   ├── AIPositionSizer.tsx # Smart position sizing
│   ├── ChartArea.tsx      # Trading chart
│   ├── OrderPanel.tsx     # Order management
│   ├── SidebarRight.tsx   # Market list
│   ├── Topbar.tsx         # Navigation
│   ├── TradingPanel.tsx   # Portfolio summary
│   └── TradeAnalyzer.tsx  # Performance analysis
├── hooks/                 # Custom React hooks
│   ├── useChartData.ts    # Chart data management
│   ├── useLivePrice.ts    # Real-time price updates
│   ├── useMarketData.ts   # Market data fetching
│   ├── useSentimentScore.ts # AI sentiment analysis
│   ├── useTradeExecution.ts # Trade execution logic
│   └── useVolatilityAlert.ts # Volatility monitoring
├── lib/                   # Core libraries
│   └── websocket-manager.ts # WebSocket connection management
├── services/              # API services
│   ├── marketService.ts   # Market data API
│   ├── profileService.ts  # User profile API
│   └── tradeService.ts    # Trade execution API
├── stores/                # Zustand stores
│   └── useTradingStore.ts # Global trading state
├── types/                 # TypeScript definitions
│   ├── trading.ts         # Core trading types
│   └── window.d.ts        # Window extensions
└── utils/                 # Utility functions
    ├── dbSync.ts          # Database synchronization
    ├── format.ts          # Formatting utilities
    └── id.ts              # ID generation
```

---

## 🎯 Key Features Explained

### Trading Chart

- Professional candlestick chart with TradingView-like interface
- Real-time price updates via WebSocket
- Multiple timeframes for technical analysis
- Volume histogram and moving averages
- Crosshair with price information display

### Order Execution

- **Market orders** for immediate execution
- **Limit orders** for price-specific entries
- **Smart position sizing** with AI recommendations
- **Price impact warnings** for large orders
- **Trade confirmation** with detailed breakdown

### AI Trading Assistant

- **Signal Generation**: BUY/SELL/HOLD recommendations with confidence scores
- **Pattern Recognition**: Detects chart patterns (trends, breakouts, reversals)
- **Position Sizing**: Calculates optimal position size using Kelly Criterion
- **Risk Management**: Stop-loss and take-profit suggestions
- **Market Sentiment**: Analyzes price action and volume for market mood

### Portfolio Management

- Real-time P&L tracking
- Active positions display
- Trade history with detailed logs
- Performance statistics and analytics
- Account reset functionality

---

## 🔄 WebSocket Architecture

### Frontend (`websocket-manager.ts`)

- **Single Connection**: One WebSocket connection to the backend proxy
- **Smart Subscriptions**: Only subscribes to active symbol and watchlist
- **Rate Limiting**: Prevents excessive updates with priority queuing
- **Auto-Reconnection**: Exponential backoff for connection recovery
- **Priority System**: High priority for active symbol, low priority for watchlist

### Backend (`index.js`)

- **Global Binance Connection**: Single WebSocket to Binance for all clients
- **Subscription Management**: Tracks all active streams
- **Broadcast**: Forwards data to all connected frontend clients
- **Health Monitoring**: Ping/pong to keep connection alive
- **Auto-Cleanup**: Closes idle connections when no clients are connected

---

## 🚀 Deployment

### Deploy Frontend to Vercel

1. **Push your code to GitHub**

2. **Import project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Select your repository

3. **Configure Environment Variables**
   Add all environment variables from `.env.local`

4. **Deploy**
   - Click "Deploy"
   - Your app will be live at `your-app.vercel.app`

### Deploy Backend

See the [Backend Repository](https://github.com/i-Programer/papertrading-api) for deployment options (Heroku, Railway, Render, or your own VPS).

### Build for Production (Frontend)

```bash
npm run build
# or
yarn build
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

**IMPORTANT**: This is a paper trading simulation for educational purposes only. All trades are simulated with virtual currency. The AI recommendations are for demonstration purposes and should not be considered financial advice. Always conduct your own research before making investment decisions.

---

## 🙏 Acknowledgments

- **[Binance](https://www.binance.com)** for market data
- **[Clerk](https://clerk.com)** for authentication
- **[Supabase](https://supabase.com)** for database
- **[Google Gemini](https://ai.google.dev/)** for AI features
- **[Lightweight Charts](https://github.com/tradingview/lightweight-charts)** for charting library
- **[Tailwind CSS](https://tailwindcss.com)** for styling
- **[Lucide](https://lucide.dev)** for icons

---

## 🔗 Quick Links

- [Frontend Repository](https://github.com/i-Programer/papertrading)
- [Backend Repository](https://github.com/i-Programer/papertrading-api)
- [Live Demo](https://papertrading-rho.vercel.app)

---

## 📊 Project Status

![GitHub stars](https://img.shields.io/github/stars/i-Programer/papertrading)
![GitHub forks](https://img.shields.io/github/forks/i-Programer/papertrading)
![GitHub issues](https://img.shields.io/github/issues/i-Programer/papertrading)
![License](https://img.shields.io/github/license/i-Programer/papertrading)

---

Made by [i-Programer](https://github.com/i-Programer)