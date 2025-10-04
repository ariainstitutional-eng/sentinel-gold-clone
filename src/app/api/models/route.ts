import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { models, auditLogs } from '@/db/schema';
import { eq, like, and, or, desc } from 'drizzle-orm';
import { z } from 'zod';

// Zod validation schemas
const modelCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  provider: z.string().min(1, 'Provider is required').max(100, 'Provider too long'),
  version: z.string().min(1, 'Version is required').max(50, 'Version too long'),
  description: z.string().optional(),
  hyperparams: z.record(z.any()).optional(),
  status: z.enum(['active', 'standby', 'training']).default('standby'),
});

// Helper function to log audit events
async function logAudit(action: string, details: string, refId?: number, level: 'info' | 'warn' | 'error' = 'info') {
  try {
    await db.insert(auditLogs).values({
      timestamp: Math.floor(Date.now() / 1000),
      category: 'model',
      action,
      details,
      refType: 'model',
      refId,
      level,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Helper function to extract bearer token from request (optional logging)
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const statusFilter = searchParams.get('status');
    const providerFilter = searchParams.get('provider');

    let query = db.select().from(models);
    let conditions = [];

    // Search across name, provider
    if (search) {
      conditions.push(
        or(
          like(models.name, `%${search}%`),
          like(models.provider, `%${search}%`)
        )
      );
    }

    // Filter by status
    if (statusFilter && ['active', 'standby', 'training'].includes(statusFilter)) {
      conditions.push(eq(models.status, statusFilter));
    }

    // Filter by provider
    if (providerFilter) {
      conditions.push(eq(models.provider, providerFilter));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(models.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET models error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const requestBody = await request.json();

    // Validate request body
    const validation = modelCreateSchema.safeParse(requestBody);
    if (!validation.success) {
      const errorMessages = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return NextResponse.json({ 
        error: `Validation failed: ${errorMessages}`,
        code: "VALIDATION_ERROR" 
      }, { status: 400 });
    }

    const { name, provider, version, description, hyperparams, status } = validation.data;

    // Check if model name already exists
    const existingModel = await db.select()
      .from(models)
      .where(eq(models.name, name))
      .limit(1);

    if (existingModel.length > 0) {
      return NextResponse.json({ 
        error: "Model name must be unique",
        code: "DUPLICATE_NAME" 
      }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Create new model
    const newModel = await db.insert(models)
      .values({
        name: name.trim(),
        provider: provider.trim(),
        version: version.trim(),
        description: description?.trim(),
        hyperparams,
        status,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    // Log model creation
    await logAudit(
      'create',
      `Model '${name}' created with provider '${provider}' version '${version}'${bearerToken ? ` (Token: ${bearerToken.substring(0, 8)}...)` : ''}`,
      newModel[0].id,
      'info'
    );

    return NextResponse.json(newModel[0], { status: 201 });
  } catch (error) {
    console.error('POST models error:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ 
        error: "Model name must be unique",
        code: "DUPLICATE_NAME" 
      }, { status: 400 });
    }

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

    const bearerToken = extractBearerToken(request);
    const requestBody = await request.json();

    // Validate request body (partial update)
    const updateSchema = modelCreateSchema.partial();
    const validation = updateSchema.safeParse(requestBody);
    if (!validation.success) {
      const errorMessages = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return NextResponse.json({ 
        error: `Validation failed: ${errorMessages}`,
        code: "VALIDATION_ERROR" 
      }, { status: 400 });
    }

    // Check if model exists
    const existingModel = await db.select()
      .from(models)
      .where(eq(models.id, parseInt(id)))
      .limit(1);

    if (existingModel.length === 0) {
      return NextResponse.json({ 
        error: 'Model not found' 
      }, { status: 404 });
    }

    const updates = validation.data;

    // If name is being updated, check uniqueness
    if (updates.name && updates.name !== existingModel[0].name) {
      const nameExists = await db.select()
        .from(models)
        .where(and(
          eq(models.name, updates.name),
          eq(models.id, parseInt(id))
        ))
        .limit(1);

      if (nameExists.length > 0) {
        return NextResponse.json({ 
          error: "Model name must be unique",
          code: "DUPLICATE_NAME" 
        }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: Math.floor(Date.now() / 1000),
    };

    if (updates.name) updateData.name = updates.name.trim();
    if (updates.provider) updateData.provider = updates.provider.trim();
    if (updates.version) updateData.version = updates.version.trim();
    if (updates.description !== undefined) updateData.description = updates.description?.trim();
    if (updates.hyperparams !== undefined) updateData.hyperparams = updates.hyperparams;
    if (updates.status) updateData.status = updates.status;

    const updatedModel = await db.update(models)
      .set(updateData)
      .where(eq(models.id, parseInt(id)))
      .returning();

    // Log model update
    await logAudit(
      'update',
      `Model '${existingModel[0].name}' updated${bearerToken ? ` (Token: ${bearerToken.substring(0, 8)}...)` : ''}`,
      parseInt(id),
      'info'
    );

    return NextResponse.json(updatedModel[0]);
  } catch (error) {
    console.error('PUT models error:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ 
        error: "Model name must be unique",
        code: "DUPLICATE_NAME" 
      }, { status: 400 });
    }

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

    const bearerToken = extractBearerToken(request);

    // Check if model exists
    const existingModel = await db.select()
      .from(models)
      .where(eq(models.id, parseInt(id)))
      .limit(1);

    if (existingModel.length === 0) {
      return NextResponse.json({ 
        error: 'Model not found' 
      }, { status: 404 });
    }

    const deletedModel = await db.delete(models)
      .where(eq(models.id, parseInt(id)))
      .returning();

    // Log model deletion
    await logAudit(
      'delete',
      `Model '${existingModel[0].name}' deleted${bearerToken ? ` (Token: ${bearerToken.substring(0, 8)}...)` : ''}`,
      parseInt(id),
      'info'
    );

    return NextResponse.json({
      message: 'Model deleted successfully',
      deletedModel: deletedModel[0]
    });
  } catch (error) {
    console.error('DELETE models error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}