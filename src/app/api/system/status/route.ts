import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemStatus } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Optional bearer token logging
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      console.log('Request with bearer token received');
    }

    // Get the latest system status record
    const latestStatus = await db.select()
      .from(systemStatus)
      .orderBy(desc(systemStatus.id))
      .limit(1);

    // If no status exists, return default values
    if (latestStatus.length === 0) {
      const defaultStatus = {
        id: null,
        mt5Connected: false,
        aiActive: false,
        riskMonitorActive: true,
        degradedMode: false,
        lastHeartbeat: Math.floor(Date.now() / 1000)
      };
      
      return NextResponse.json(defaultStatus, { status: 200 });
    }

    // Return the latest status record
    return NextResponse.json(latestStatus[0], { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}