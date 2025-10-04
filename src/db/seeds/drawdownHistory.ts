import { db } from '@/db';
import { drawdownHistory } from '@/db/schema';

async function main() {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    const sampleDrawdownHistory = [
        {
            timestamp: thirtyDaysAgo,
            equityPeak: 10000.00,
            currentEquity: 10000.00,
            drawdownPct: 0.0,
            drawdownAmount: 0.0,
            recovered: true,
        },
        {
            timestamp: thirtyDaysAgo + (1 * 24 * 60 * 60 * 1000),
            equityPeak: 10000.00,
            currentEquity: 9950.00,
            drawdownPct: 2.0,
            drawdownAmount: 50.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (2 * 24 * 60 * 60 * 1000),
            equityPeak: 10150.00,
            currentEquity: 10150.00,
            drawdownPct: 0.0,
            drawdownAmount: 0.0,
            recovered: true,
        },
        {
            timestamp: thirtyDaysAgo + (3 * 24 * 60 * 60 * 1000),
            equityPeak: 10150.00,
            currentEquity: 9875.00,
            drawdownPct: 2.7,
            drawdownAmount: 275.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (5 * 24 * 60 * 60 * 1000),
            equityPeak: 10275.00,
            currentEquity: 10275.00,
            drawdownPct: 0.0,
            drawdownAmount: 0.0,
            recovered: true,
        },
        {
            timestamp: thirtyDaysAgo + (6 * 24 * 60 * 60 * 1000),
            equityPeak: 10275.00,
            currentEquity: 9820.00,
            drawdownPct: 4.4,
            drawdownAmount: 455.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (7 * 24 * 60 * 60 * 1000),
            equityPeak: 10275.00,
            currentEquity: 9950.00,
            drawdownPct: 3.2,
            drawdownAmount: 325.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (8 * 24 * 60 * 60 * 1000),
            equityPeak: 10275.00,
            currentEquity: 10100.00,
            drawdownPct: 1.7,
            drawdownAmount: 175.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (9 * 24 * 60 * 60 * 1000),
            equityPeak: 10275.00,
            currentEquity: 10225.00,
            drawdownPct: 0.5,
            drawdownAmount: 50.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (10 * 24 * 60 * 60 * 1000),
            equityPeak: 10350.00,
            currentEquity: 10350.00,
            drawdownPct: 0.0,
            drawdownAmount: 0.0,
            recovered: true,
        },
        {
            timestamp: thirtyDaysAgo + (12 * 24 * 60 * 60 * 1000),
            equityPeak: 10350.00,
            currentEquity: 9980.00,
            drawdownPct: 3.6,
            drawdownAmount: 370.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (15 * 24 * 60 * 60 * 1000),
            equityPeak: 10350.00,
            currentEquity: 9750.00,
            drawdownPct: 5.8,
            drawdownAmount: 600.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (20 * 24 * 60 * 60 * 1000),
            equityPeak: 10350.00,
            currentEquity: 9890.00,
            drawdownPct: 4.4,
            drawdownAmount: 460.0,
            recovered: false,
        },
        {
            timestamp: thirtyDaysAgo + (25 * 24 * 60 * 60 * 1000),
            equityPeak: 10350.00,
            currentEquity: 10125.00,
            drawdownPct: 2.2,
            drawdownAmount: 225.0,
            recovered: false,
        },
        {
            timestamp: now - (2 * 60 * 60 * 1000),
            equityPeak: 10350.00,
            currentEquity: 10285.00,
            drawdownPct: 0.6,
            drawdownAmount: 65.0,
            recovered: false,
        }
    ];

    await db.insert(drawdownHistory).values(sampleDrawdownHistory);
    
    console.log('✅ Drawdown history seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});