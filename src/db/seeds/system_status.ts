import { db } from '@/db';
import { systemStatus } from '@/db/schema';

async function main() {
    const initialSystemState = [
        {
            mt5Connected: false,
            aiActive: false,
            riskMonitorActive: true,
            degradedMode: false,
            lastHeartbeat: Math.floor(new Date().getTime() / 1000),
        }
    ];

    await db.insert(systemStatus).values(initialSystemState);
    
    console.log('✅ System status seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});