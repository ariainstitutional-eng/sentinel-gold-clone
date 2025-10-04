import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, auditLogs } from '@/db/schema';
import { eq, like, and, or, desc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const accountSchema = z.object({
  broker: z.string().min(1, 'Broker is required').max(100, 'Broker must be 100 characters or less'),
  server: z.string().min(1, 'Server is required').max(255, 'Server must be 255 characters or less'),
  login: z.string().min(1, 'Login is required').regex(/^[a-zA-Z0-9]+$/, 'Login must be alphanumeric'),
  alias: z.string().max(255, 'Alias must be 255 characters or less').optional(),
  balance: z.number().min(0, 'Balance must be 0 or greater'),
  equity: z.number().min(0, 'Equity must be 0 or greater'),
  marginLevel: z.number().min(0, 'Margin level must be 0 or greater').max(10000, 'Margin level must be 10000 or less').optional(),
  status: z.enum(['connected', 'disconnected'], {
    errorMap: () => ({ message: 'Status must be either "connected" or "disconnected"' })
  }).default('disconnected'),
});

const querySchema = z.object({
  limit: z.string().nullable().transform(val => {
    const parsed = parseInt(val || '10', 10);
    return isNaN(parsed) ? 10 : Math.min(Math.max(parsed, 1), 50);
  }),
  offset: z.string().nullable().transform(val => {
    const parsed = parseInt(val || '0', 10);
    return isNaN(parsed) ? 0 : Math.max(parsed, 0);
  }),
  broker: z.string().nullable(),
  status: z.enum(['connected', 'disconnected']).nullable(),
  search: z.string().nullable(),
});

// Audit logging helper
async function logAudit(action: string, details: string, refId?: number) {
  try {
    await db.insert(auditLogs).values({
      timestamp: Math.floor(Date.now() / 1000),
      category: 'execution',
      action,
      details,
      refType: 'account',
      refId,
      level: 'info',
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      broker: searchParams.get('broker'),
      status: searchParams.get('status'),
      search: searchParams.get('search'),
    });

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
        code: 'INVALID_QUERY_PARAMS'
      }, { status: 400 });
    }

    const { limit, offset, broker, status, search } = validation.data;

    let query = db.select().from(accounts);
    const conditions = [];

    // Apply filters
    if (broker) {
      conditions.push(eq(accounts.broker, broker));
    }

    if (status) {
      conditions.push(eq(accounts.status, status));
    }

    if (search) {
      const searchCondition = or(
        like(accounts.broker, `%${search}%`),
        like(accounts.server, `%${search}%`),
        like(accounts.login, `%${search}%`),
        like(accounts.alias, `%${search}%`)
      );
      conditions.push(searchCondition);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(accounts.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);

  } catch (error) {
    console.error('GET accounts error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input data
    const validation = accountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.errors,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const validatedData = validation.data;
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Check if account already exists (same broker, server, login)
    const existingAccount = await db.select()
      .from(accounts)
      .where(and(
        eq(accounts.broker, validatedData.broker),
        eq(accounts.server, validatedData.server),
        eq(accounts.login, validatedData.login)
      ))
      .limit(1);

    let result;
    let action;

    if (existingAccount.length > 0) {
      // Update existing account
      const accountId = existingAccount[0].id;
      const updateData = {
        ...validatedData,
        updatedAt: currentTimestamp,
      };

      result = await db.update(accounts)
        .set(updateData)
        .where(eq(accounts.id, accountId))
        .returning();

      action = 'account_updated';
      
      await logAudit(
        action,
        `Updated account: ${validatedData.broker} - ${validatedData.server} - ${validatedData.login}`,
        accountId
      );

    } else {
      // Create new account
      const insertData = {
        ...validatedData,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      };

      result = await db.insert(accounts)
        .values(insertData)
        .returning();

      action = 'account_created';
      
      await logAudit(
        action,
        `Created account: ${validatedData.broker} - ${validatedData.server} - ${validatedData.login}`,
        result[0].id
      );
    }

    return NextResponse.json(result[0], { status: existingAccount.length > 0 ? 200 : 201 });

  } catch (error) {
    console.error('POST accounts error:', error);
    
    await logAudit(
      'account_creation_failed',
      `Failed to create/update account: ${error}`,
    );

    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({
        error: "Valid ID is required",
        code: "INVALID_ID"
      }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate input data
    const validation = accountSchema.partial().safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.errors,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const validatedData = validation.data;

    // Check if account exists
    const existingAccount = await db.select()
      .from(accounts)
      .where(eq(accounts.id, parseInt(id)))
      .limit(1);

    if (existingAccount.length === 0) {
      return NextResponse.json({
        error: 'Account not found',
        code: 'ACCOUNT_NOT_FOUND'
      }, { status: 404 });
    }

    // Update account
    const updateData = {
      ...validatedData,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    const updated = await db.update(accounts)
      .set(updateData)
      .where(eq(accounts.id, parseInt(id)))
      .returning();

    await logAudit(
      'account_updated',
      `Updated account ID ${id}: ${JSON.stringify(validatedData)}`,
      parseInt(id)
    );

    return NextResponse.json(updated[0]);

  } catch (error) {
    console.error('PUT accounts error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({
        error: "Valid ID is required",
        code: "INVALID_ID"
      }, { status: 400 });
    }

    // Check if account exists
    const existingAccount = await db.select()
      .from(accounts)
      .where(eq(accounts.id, parseInt(id)))
      .limit(1);

    if (existingAccount.length === 0) {
      return NextResponse.json({
        error: 'Account not found',
        code: 'ACCOUNT_NOT_FOUND'
      }, { status: 404 });
    }

    // Delete account
    const deleted = await db.delete(accounts)
      .where(eq(accounts.id, parseInt(id)))
      .returning();

    await logAudit(
      'account_deleted',
      `Deleted account: ${existingAccount[0].broker} - ${existingAccount[0].server} - ${existingAccount[0].login}`,
      parseInt(id)
    );

    return NextResponse.json({
      message: 'Account deleted successfully',
      account: deleted[0]
    });

  } catch (error) {
    console.error('DELETE accounts error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}