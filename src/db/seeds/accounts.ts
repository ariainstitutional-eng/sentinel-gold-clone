import { db } from '@/db';
import { accounts } from '@/db/schema';

async function main() {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    const sampleAccounts = [
        {
            broker: 'IC Markets',
            server: 'ICMarkets-Demo01',
            login: 'DEMO12345',
            alias: 'AI Trading Demo Account',
            balance: 10000.00,
            equity: 10000.00,
            marginLevel: 100.0,
            status: 'disconnected',
            createdAt: currentTimestamp,
            updatedAt: currentTimestamp,
        }
    ];

    await db.insert(accounts).values(sampleAccounts);
    
    console.log('✅ Accounts seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});