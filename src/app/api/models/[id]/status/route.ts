import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { models, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const statusSchema = z.object({
  status: z.enum(['active', 'standby', 'training'], {
    errorMap: () => ({ message: 'Status must be one of: active, standby, training' })
  })
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({
        error: "Valid ID is required",
        code: "INVALID_ID"
      }, { status: 400 });
    }

    const modelId = parseInt(id);
    
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json({
        error: "Invalid JSON in request body",
        code: "INVALID_JSON"
      }, { status: 400 });
    }

    // Validate request body with Zod
    const validation = statusSchema.safeParse(requestBody);
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(err => err.message).join(', ');
      return NextResponse.json({
        error: errorMessage,
        code: "VALIDATION_ERROR"
      }, { status: 400 });
    }

    const { status } = validation.data;

    // Check if model exists
    const existingModel = await db.select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);

    if (existingModel.length === 0) {
      return NextResponse.json({
        error: "Model not found",
        code: "MODEL_NOT_FOUND"
      }, { status: 404 });
    }

    const currentModel = existingModel[0];
    const previousStatus = currentModel.status;

    // Update model status
    const updatedModel = await db.update(models)
      .set({
        status,
        updatedAt: Math.floor(Date.now() / 1000)
      })
      .where(eq(models.id, modelId))
      .returning();

    if (updatedModel.length === 0) {
      return NextResponse.json({
        error: "Failed to update model",
        code: "UPDATE_FAILED"
      }, { status: 500 });
    }

    // Extract bearer token for audit logging (optional)
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7).substring(0, 10) + '...' 
      : 'none';

    // Create audit log for status change
    await db.insert(auditLogs).values({
      timestamp: Math.floor(Date.now() / 1000),
      category: 'model',
      action: 'status_update',
      details: JSON.stringify({
        modelId,
        modelName: currentModel.name,
        previousStatus,
        newStatus: status,
        bearer: bearerToken,
        userAgent: request.headers.get('user-agent')?.substring(0, 100) || 'unknown'
      }),
      refType: 'model',
      refId: modelId,
      level: 'info'
    });

    return NextResponse.json(updatedModel[0], { status: 200 });

  } catch (error) {
    console.error('PATCH /api/models/[id]/status error:', error);
    
    // Log error to audit table
    try {
      await db.insert(auditLogs).values({
        timestamp: Math.floor(Date.now() / 1000),
        category: 'system',
        action: 'api_error',
        details: JSON.stringify({
          endpoint: '/api/models/[id]/status',
          method: 'PATCH',
          error: error instanceof Error ? error.message : 'Unknown error',
          modelId: params?.id || 'unknown'
        }),
        refType: 'api',
        refId: null,
        level: 'error'
      });
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }

    return NextResponse.json({
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
      code: "INTERNAL_ERROR"
    }, { status: 500 });
  }
}