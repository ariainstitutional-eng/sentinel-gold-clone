import { db } from '@/db';
import { riskLimits } from '@/db/schema';

async function main() {
    const currentTimestamp = Date.now();
    
    const institutionalRiskConfig = [
        {
            maxDailyLoss: 200.0,
            maxDrawdownPct: 10.0,
            maxRiskPerTradePct: 1.0,
            maxConcurrentPositions: 3,
            capitalProtectionEnabled: true,
            createdAt: currentTimestamp,
            updatedAt: currentTimestamp,
        }
    ];

    await db.insert(riskLimits).values(institutionalRiskConfig);
    
    console.log('✅ Risk limits seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});