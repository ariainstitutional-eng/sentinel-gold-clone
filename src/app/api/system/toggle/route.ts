import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemStatus, auditLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for request body
const toggleRequestSchema = z.object({
  aiActive: z.boolean().optional(),
  riskMonitorActive: z.boolean().optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    
    // Validate with zod
    const validation = toggleRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
        details: validation.error.errors
      }, { status: 400 });
    }

    const { aiActive, riskMonitorActive } = validation.data;

    // Check if any updates are provided
    if (aiActive === undefined && riskMonitorActive === undefined) {
      return NextResponse.json({
        error: "At least one status field must be provided",
        code: "NO_UPDATES_PROVIDED"
      }, { status: 400 });
    }

    // Get current system status from database
    const currentStatusResult = await db.select()
      .from(systemStatus)
      .orderBy(desc(systemStatus.id))
      .limit(1);

    let currentStatus;
    if (currentStatusResult.length === 0) {
      // No existing status, create default
      currentStatus = {
        mt5Connected: false,
        aiActive: false,
        riskMonitorActive: true,
        degradedMode: false,
        lastHeartbeat: Date.now()
      };
    } else {
      currentStatus = currentStatusResult[0];
    }

    // Prepare updates object with only allowed fields
    const updates: any = {
      // Always update lastHeartbeat
      lastHeartbeat: Date.now(),
      // Preserve system-managed fields
      mt5Connected: currentStatus.mt5Connected,
      degradedMode: currentStatus.degradedMode
    };

    // Apply only allowed updates
    if (aiActive !== undefined) {
      updates.aiActive = aiActive;
    } else {
      updates.aiActive = currentStatus.aiActive;
    }

    if (riskMonitorActive !== undefined) {
      updates.riskMonitorActive = riskMonitorActive;
    } else {
      updates.riskMonitorActive = currentStatus.riskMonitorActive;
    }

    // Create new system status row
    const newStatusResult = await db.insert(systemStatus)
      .values(updates)
      .returning();

    const newStatus = newStatusResult[0];

    // Create audit logs for each changed field
    const auditEntries = [];
    const timestamp = Date.now();

    // Check for AI status change
    if (aiActive !== undefined && aiActive !== currentStatus.aiActive) {
      auditEntries.push({
        timestamp,
        category: 'system',
        action: 'status_toggle',
        details: `AI trading status changed from ${currentStatus.aiActive} to ${aiActive}`,
        refType: 'system_status',
        refId: newStatus.id,
        level: 'info'
      });
    }

    // Check for risk monitor status change
    if (riskMonitorActive !== undefined && riskMonitorActive !== currentStatus.riskMonitorActive) {
      auditEntries.push({
        timestamp,
        category: 'system',
        action: 'status_toggle',
        details: `Risk monitor status changed from ${currentStatus.riskMonitorActive} to ${riskMonitorActive}`,
        refType: 'system_status',
        refId: newStatus.id,
        level: 'info'
      });
    }

    // System heartbeat update audit
    auditEntries.push({
      timestamp,
      category: 'system',
      action: 'heartbeat_update',
      details: `System heartbeat updated to ${new Date(updates.lastHeartbeat).toISOString()}`,
      refType: 'system_status',
      refId: newStatus.id,
      level: 'info'
    });

    // Insert all audit log entries
    if (auditEntries.length > 0) {
      await db.insert(auditLogs).values(auditEntries);
    }

    // Convert boolean integers to actual booleans for response
    const responseStatus = {
      id: newStatus.id,
      mt5Connected: Boolean(newStatus.mt5Connected),
      aiActive: Boolean(newStatus.aiActive),
      riskMonitorActive: Boolean(newStatus.riskMonitorActive),
      degradedMode: Boolean(newStatus.degradedMode),
      lastHeartbeat: newStatus.lastHeartbeat
    };

    return NextResponse.json(responseStatus, { status: 200 });

  } catch (error) {
    console.error('POST /api/system/toggle error:', error);
    
    // Create error audit log
    try {
      await db.insert(auditLogs).values({
        timestamp: Date.now(),
        category: 'system',
        action: 'status_toggle_error',
        details: `System status toggle failed: ${error}`,
        refType: 'system_status',
        refId: null,
        level: 'error'
      });
    } catch (auditError) {
      console.error('Failed to create audit log for error:', auditError);
    }

    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}