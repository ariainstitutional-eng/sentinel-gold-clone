import { db } from '@/db';
import { autoTradingConfig } from '@/db/schema';

async function main() {
    const sampleConfigs = [
        {
            enabled: false,
            maxDailyTrades: 5,
            maxDailyLoss: 200.0,
            maxPositionSize: 0.5,
            emergencyStopLoss: true,
            tradingHoursStart: '08:00',
            tradingHoursEnd: '18:00',
            allowedSymbols: JSON.stringify(['XAUUSD']),
            minConfidenceThreshold: 0.8,
            riskPerTrade: 0.5,
            createdAt: Math.floor(new Date('2024-01-10T08:00:00Z').getTime() / 1000),
            updatedAt: Math.floor(new Date('2024-01-10T08:00:00Z').getTime() / 1000),
        },
        {
            enabled: true,
            maxDailyTrades: 10,
            maxDailyLoss: 500.0,
            maxPositionSize: 1.0,
            emergencyStopLoss: true,
            tradingHoursStart: '00:00',
            tradingHoursEnd: '23:59',
            allowedSymbols: JSON.stringify(['XAUUSD', 'EURUSD']),
            minConfidenceThreshold: 0.7,
            riskPerTrade: 1.0,
            createdAt: Math.floor(new Date('2024-01-15T10:30:00Z').getTime() / 1000),
            updatedAt: Math.floor(new Date('2024-01-15T10:30:00Z').getTime() / 1000),
        },
        {
            enabled: false,
            maxDailyTrades: 20,
            maxDailyLoss: 1000.0,
            maxPositionSize: 2.0,
            emergencyStopLoss: true,
            tradingHoursStart: '06:00',
            tradingHoursEnd: '22:00',
            allowedSymbols: JSON.stringify(['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY']),
            minConfidenceThreshold: 0.6,
            riskPerTrade: 2.0,
            createdAt: Math.floor(new Date('2024-01-20T14:15:00Z').getTime() / 1000),
            updatedAt: Math.floor(new Date('2024-01-20T14:15:00Z').getTime() / 1000),
        }
    ];

    await db.insert(autoTradingConfig).values(sampleConfigs);
    
    console.log('✅ Auto trading configuration seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});