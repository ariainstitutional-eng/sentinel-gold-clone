import { db } from '@/db';
import { performanceMetrics } from '@/db/schema';

async function main() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    const sampleMetrics = [
        {
            date: Math.floor(new Date(sevenDaysAgo.getTime() + (0 * 24 * 60 * 60 * 1000)).getTime() / 1000),
            totalTrades: 8,
            winningTrades: 6,
            losingTrades: 2,
            totalPnL: 150.50,
            winRate: (6 / 8) * 100,
            avgWin: 35.0,
            avgLoss: -22.25,
            profitFactor: (6 * 35.0) / Math.abs(2 * -22.25),
            sharpeRatio: 1.8,
            maxDrawdown: 15.0,
            equity: 10150.50,
            createdAt: Math.floor(new Date(sevenDaysAgo.getTime() + (0 * 24 * 60 * 60 * 1000)).getTime() / 1000),
        },
        {
            date: Math.floor(new Date(sevenDaysAgo.getTime() + (1 * 24 * 60 * 60 * 1000)).getTime() / 1000),
            totalTrades: 5,
            winningTrades: 3,
            losingTrades: 2,
            totalPnL: 45.25,
            winRate: (3 / 5) * 100,
            avgWin: 28.75,
            avgLoss: -14.00,
            profitFactor: (3 * 28.75) / Math.abs(2 * -14.00),
            sharpeRatio: 0.9,
            maxDrawdown: 28.0,
            equity: 10195.75,
            createdAt: Math.floor(new Date(sevenDaysAgo.getTime() + (1 * 24 * 60 * 60 * 1000)).getTime() / 1000),
        },
        {
            date: Math.floor(new Date(sevenDaysAgo.getTime() + (2 * 24 * 60 * 60 * 1000)).getTime() / 1000),
            totalTrades: 6,
            winningTrades: 2,
            losingTrades: 4,
            totalPnL: -85.50,
            winRate: (2 / 6) * 100,
            avgWin: 15.00,
            avgLoss: -28.88,
            profitFactor: (2 * 15.00) / Math.abs(4 * -28.88),
            sharpeRatio: -0.5,
            maxDrawdown: 115.50,
            equity: 10110.25,
            createdAt: Math.floor(new Date(sevenDaysAgo.getTime() + (2 * 24 * 60 * 60 * 1000)).getTime() / 1000),
        },
        {
            date: Math.floor(new Date(sevenDaysAgo.getTime() + (3 * 24 * 60 * 60 * 1000)).getTime() / 1000),
            totalTrades: 7,
            winningTrades: 5,
            losingTrades: 2,
            totalPnL: 125.75,
            winRate: (5 / 7) * 100,
            avgWin: 32.15,
            avgLoss: -19.50,
            profitFactor: (5 * 32.15) / Math.abs(2 * -19.50),
            sharpeRatio: 1.4,
            maxDrawdown: 39.0,
            equity: 10236.00,
            createdAt: Math.floor(new Date(sevenDaysAgo.getTime() + (3 * 24 * 60 * 60 * 1000)).getTime() / 1000),
        },
        {
            date: Math.floor(new Date(sevenDaysAgo.getTime() + (4 * 24 * 60 * 60 * 1000)).getTime() / 1000),
            totalTrades: 4,
            winningTrades: 2,
            losingTrades: 2,
            totalPnL: 5.25,
            winRate: (2 / 4) * 100,
            avgWin: 18.75,
            avgLoss: -16.25,
            profitFactor: (2 * 18.75) / Math.abs(2 * -16.25),
            sharpeRatio: 0.1,
            maxDrawdown: 32.50,
            equity: 10241.25,
            createdAt: Math.floor(new Date(sevenDaysAgo.getTime() + (4 * 24 * 60 * 60 * 1000)).getTime() / 1000),
        },
        {
            date: Math.floor(new Date(sevenDaysAgo.getTime() + (5 * 24 * 60 * 60 * 1000)).getTime() / 1000),
            totalTrades: 9,
            winningTrades: 7,
            losingTrades: 2,
            totalPnL: 195.50,
            winRate: (7 / 9) * 100,
            avgWin: 38.50,
            avgLoss: -26.25,
            profitFactor: (7 * 38.50) / Math.abs(2 * -26.25),
            sharpeRatio: 2.1,
            maxDrawdown: 52.50,
            equity: 10436.75,
            createdAt: Math.floor(new Date(sevenDaysAgo.getTime() + (5 * 24 * 60 * 60 * 1000)).getTime() / 1000),
        },
        {
            date: Math.floor(new Date(sevenDaysAgo.getTime() + (6 * 24 * 60 * 60 * 1000)).getTime() / 1000),
            totalTrades: 6,
            winningTrades: 4,
            losingTrades: 2,
            totalPnL: 75.25,
            winRate: (4 / 6) * 100,
            avgWin: 25.50,
            avgLoss: -13.00,
            profitFactor: (4 * 25.50) / Math.abs(2 * -13.00),
            sharpeRatio: 1.2,
            maxDrawdown: 26.0,
            equity: 10512.00,
            createdAt: Math.floor(new Date(sevenDaysAgo.getTime() + (6 * 24 * 60 * 60 * 1000)).getTime() / 1000),
        },
    ];

    await db.insert(performanceMetrics).values(sampleMetrics);
    
    console.log('✅ Performance metrics seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});