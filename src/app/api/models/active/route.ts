import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { models } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Optional bearer token logging
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('Bearer token received:', token.substring(0, 10) + '...');
    }

    // First, try to find an active model
    const activeModel = await db.select()
      .from(models)
      .where(eq(models.status, 'active'))
      .limit(1);

    // If active model exists, return it as single object
    if (activeModel.length > 0) {
      const model = activeModel[0];
      return NextResponse.json({
        id: model.id,
        name: model.name,
        provider: model.provider,
        version: model.version,
        description: model.description,
        hyperparams: model.hyperparams,
        status: model.status,
        createdAt: new Date(model.createdAt * 1000).toISOString(),
        updatedAt: new Date(model.updatedAt * 1000).toISOString()
      }, { status: 200 });
    }

    // No active model found, look for standby models
    const standbyModels = await db.select()
      .from(models)
      .where(eq(models.status, 'standby'));

    // If standby models exist, return them as array
    if (standbyModels.length > 0) {
      const formattedModels = standbyModels.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        version: model.version,
        description: model.description,
        hyperparams: model.hyperparams,
        status: model.status,
        createdAt: new Date(model.createdAt * 1000).toISOString(),
        updatedAt: new Date(model.updatedAt * 1000).toISOString()
      }));
      
      return NextResponse.json(formattedModels, { status: 200 });
    }

    // No models exist at all
    return NextResponse.json({ 
      error: "No models found in the system",
      code: "NO_MODELS_FOUND" 
    }, { status: 404 });

  } catch (error) {
    console.error('GET /api/models/active error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}