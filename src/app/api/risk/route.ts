import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { riskLimits, auditLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for risk limits
const riskLimitsSchema = z.object({
  maxDailyLoss: z.number().positive().optional(),
  maxDrawdownPct: z.number().min(1).max(50).optional(),
  maxRiskPerTradePct: z.number().min(0.1).max(5.0).optional(),
  maxConcurrentPositions: z.number().int().min(1).max(20).optional(),
  capitalProtectionEnabled: z.boolean().optional(),
}).refine((data) => {
  if (data.capitalProtectionEnabled === false) {
    return false;
  }
  return true;
}, {
  message: "Capital protection cannot be disabled",
  path: ["capitalProtectionEnabled"],
});

// Default institutional risk limits
const DEFAULT_RISK_LIMITS = {
  id: 0,
  maxDailyLoss: 10000,
  maxDrawdownPct: 20,
  maxRiskPerTradePct: 2.0,
  maxConcurrentPositions: 5,
  capitalProtectionEnabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Audit logging helper
async function logAuditEvent(action: string, details: string, level: 'info' | 'warn' | 'error' = 'info') {
  try {
    await db.insert(auditLogs).values({
      timestamp: Date.now(),
      category: 'risk',
      action,
      details,
      refType: 'risk_limits',
      refId: null,
      level,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the most recent risk limits
    const currentLimits = await db.select()
      .from(riskLimits)
      .orderBy(desc(riskLimits.createdAt))
      .limit(1);

    if (currentLimits.length === 0) {
      // Return default institutional values if no limits exist
      await logAuditEvent('get_risk_limits', 'No risk limits found, returning defaults', 'info');
      return NextResponse.json(DEFAULT_RISK_LIMITS);
    }

    await logAuditEvent('get_risk_limits', `Retrieved current risk limits (ID: ${currentLimits[0].id})`, 'info');
    return NextResponse.json(currentLimits[0]);

  } catch (error) {
    console.error('GET /api/risk error:', error);
    await logAuditEvent('get_risk_limits', `Error: ${error}`, 'error');
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = riskLimitsSchema.safeParse(body);
    if (!validation.success) {
      const errorDetails = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      await logAuditEvent('update_risk_limits', `Validation failed: ${errorDetails}`, 'error');
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validation.error.errors,
        code: "VALIDATION_ERROR" 
      }, { status: 400 });
    }

    // Check if attempting to disable capital protection
    if (body.capitalProtectionEnabled === false) {
      await logAuditEvent('update_risk_limits', 'Attempted to disable capital protection', 'error');
      return NextResponse.json({ 
        error: "Capital protection cannot be disabled",
        code: "CAPITAL_PROTECTION_REQUIRED" 
      }, { status: 400 });
    }

    // Get current risk limits to merge with updates
    const currentLimits = await db.select()
      .from(riskLimits)
      .orderBy(desc(riskLimits.createdAt))
      .limit(1);

    const baseLimits = currentLimits.length > 0 ? currentLimits[0] : DEFAULT_RISK_LIMITS;

    // Prepare updated data
    const updatedData = {
      maxDailyLoss: body.maxDailyLoss ?? baseLimits.maxDailyLoss,
      maxDrawdownPct: body.maxDrawdownPct ?? baseLimits.maxDrawdownPct,
      maxRiskPerTradePct: body.maxRiskPerTradePct ?? baseLimits.maxRiskPerTradePct,
      maxConcurrentPositions: body.maxConcurrentPositions ?? baseLimits.maxConcurrentPositions,
      capitalProtectionEnabled: true, // Always enforce as true
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create new risk limits row for historical tracking
    const newLimits = await db.insert(riskLimits)
      .values(updatedData)
      .returning();

    if (newLimits.length === 0) {
      await logAuditEvent('update_risk_limits', 'Failed to create new risk limits', 'error');
      return NextResponse.json({ 
        error: 'Failed to update risk limits',
        code: "UPDATE_FAILED" 
      }, { status: 500 });
    }

    // Log the update with details
    const updateDetails = Object.keys(body)
      .filter(key => key in updatedData)
      .map(key => `${key}: ${body[key]}`)
      .join(', ');

    await logAuditEvent('update_risk_limits', `Updated risk limits (ID: ${newLimits[0].id}): ${updateDetails}`, 'info');

    return NextResponse.json(newLimits[0]);

  } catch (error) {
    console.error('PATCH /api/risk error:', error);
    await logAuditEvent('update_risk_limits', `Error: ${error}`, 'error');
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}