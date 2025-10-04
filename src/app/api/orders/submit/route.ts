import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, auditLogs } from '@/db/schema';
import { z } from 'zod';

// Zod validation schema for order submission
const orderSubmissionSchema = z.object({
  accountId: z.number().int().positive("Account ID must be a positive integer"),
  symbol: z.string().optional().default('XAUUSD'),
  side: z.enum(['buy', 'sell'], { 
    errorMap: () => ({ message: "Side must be 'buy' or 'sell'" }) 
  }),
  volume: z.number().positive("Volume must be positive"),
  type: z.enum(['market', 'limit', 'stop'], { 
    errorMap: () => ({ message: "Type must be 'market', 'limit', or 'stop'" }) 
  }),
  price: z.number().positive("Price must be positive").optional(),
  sl: z.number().positive("Stop loss must be positive").optional(),
  tp: z.number().positive("Take profit must be positive").optional(),
  fusedSignalId: z.number().int().positive("Fused signal ID must be a positive integer").optional(),
}).refine((data) => {
  // Price is required for limit and stop orders
  if ((data.type === 'limit' || data.type === 'stop') && !data.price) {
    return false;
  }
  return true;
}, {
  message: "Price is required for limit and stop orders",
  path: ['price']
});

// MT5 Bridge response schemas
const mt5SuccessResponseSchema = z.object({
  success: z.literal(true),
  orderId: z.string(),
  executionPrice: z.number().optional()
});

const mt5ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string()
});

// Deterministic random number generator with seed
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Deterministic backoff with seed=42
function calculateBackoffDelay(attempt: number, baseSeed: number = 42): number {
  const rng = new SeededRandom(baseSeed + attempt);
  const jitter = rng.next() * 0.1; // 10% jitter
  const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s
  return Math.floor(baseDelay * (1 + jitter));
}

// Timeout wrapper for fetch with AbortController
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Create audit log entry
async function createAuditLog(category: string, action: string, details: string, refType?: string, refId?: number, level: string = 'info') {
  try {
    await db.insert(auditLogs).values({
      timestamp: Date.now(),
      category,
      action,
      details,
      refType,
      refId,
      level
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

// Call MT5 Bridge service with retry logic
async function callMT5Bridge(orderData: any, orderId: number, maxRetries: number = 2): Promise<{ success: boolean; data?: any; error?: string }> {
  const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL;
  
  if (!MT5_BRIDGE_URL) {
    throw new Error('MT5_BRIDGE_URL environment variable not configured');
  }
  
  const payload = {
    symbol: orderData.symbol,
    side: orderData.side,
    volume: orderData.volume,
    type: orderData.type,
    ...(orderData.price && { price: orderData.price }),
    ...(orderData.sl && { sl: orderData.sl }),
    ...(orderData.tp && { tp: orderData.tp })
  };
  
  let lastError: string = '';
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await createAuditLog(
        'execution', 
        'mt5_bridge_call_attempt', 
        `Attempting MT5 bridge call (attempt ${attempt + 1}/${maxRetries + 1}) for order ${orderId}`, 
        'order', 
        orderId
      );
      
      const response = await fetchWithTimeout(`${MT5_BRIDGE_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }, 10000);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      
      // Validate response format
      const successResult = mt5SuccessResponseSchema.safeParse(responseData);
      if (successResult.success) {
        await createAuditLog(
          'execution', 
          'mt5_bridge_success', 
          `MT5 bridge call successful for order ${orderId}: ${JSON.stringify(responseData)}`, 
          'order', 
          orderId
        );
        return { success: true, data: successResult.data };
      }
      
      const errorResult = mt5ErrorResponseSchema.safeParse(responseData);
      if (errorResult.success) {
        await createAuditLog(
          'execution', 
          'mt5_bridge_business_error', 
          `MT5 bridge business error for order ${orderId}: ${errorResult.data.error}`, 
          'order', 
          orderId, 
          'error'
        );
        // Business logic errors - no retry
        return { success: false, error: errorResult.data.error };
      }
      
      // Invalid response format
      lastError = 'Invalid response format from MT5 bridge';
      throw new Error(lastError);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      lastError = errorMessage;
      
      await createAuditLog(
        'execution', 
        'mt5_bridge_error', 
        `MT5 bridge call failed (attempt ${attempt + 1}/${maxRetries + 1}) for order ${orderId}: ${errorMessage}`, 
        'order', 
        orderId, 
        'error'
      );
      
      // Check if this is a retryable error
      const isRetryable = errorMessage.includes('timeout') || 
                         errorMessage.includes('network') || 
                         errorMessage.includes('ECONNREFUSED') ||
                         errorMessage.includes('fetch');
      
      if (!isRetryable || attempt === maxRetries) {
        return { success: false, error: lastError };
      }
      
      // Wait with deterministic backoff before retry
      const delay = calculateBackoffDelay(attempt, 42);
      await createAuditLog(
        'execution', 
        'mt5_bridge_retry_delay', 
        `Retrying MT5 bridge call in ${delay}ms for order ${orderId}`, 
        'order', 
        orderId
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return { success: false, error: lastError };
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const requestBody = await request.json();
    
    const validation = orderSubmissionSchema.safeParse(requestBody);
    if (!validation.success) {
      await createAuditLog(
        'execution', 
        'order_validation_failed', 
        `Order validation failed: ${JSON.stringify(validation.error.errors)}`, 
        undefined, 
        undefined, 
        'error'
      );
      
      return NextResponse.json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: validation.error.errors
      }, { status: 400 });
    }
    
    const orderData = validation.data;
    
    // Create order record with pending status
    const newOrder = await db.insert(orders).values({
      accountId: orderData.accountId,
      symbol: orderData.symbol,
      side: orderData.side,
      volume: orderData.volume,
      type: orderData.type,
      price: orderData.price,
      sl: orderData.sl,
      tp: orderData.tp,
      placedAt: Date.now(),
      status: 'pending',
      fusedSignalId: orderData.fusedSignalId
    }).returning();
    
    if (newOrder.length === 0) {
      throw new Error('Failed to create order record');
    }
    
    const order = newOrder[0];
    
    await createAuditLog(
      'execution', 
      'order_created', 
      `Order created with ID ${order.id}: ${JSON.stringify(orderData)}`, 
      'order', 
      order.id
    );
    
    // Call MT5 Bridge service
    const mt5Result = await callMT5Bridge(orderData, order.id);
    
    if (mt5Result.success && mt5Result.data) {
      // Update order status to filled and store MT5 order ID
      const updatedOrder = await db.update(orders)
        .set({
          status: 'filled',
          mt5OrderId: mt5Result.data.orderId
        })
        .where(eq(orders.id, order.id))
        .returning();
      
      await createAuditLog(
        'execution', 
        'order_filled', 
        `Order ${order.id} filled successfully. MT5 Order ID: ${mt5Result.data.orderId}${mt5Result.data.executionPrice ? `, Execution Price: ${mt5Result.data.executionPrice}` : ''}`, 
        'order', 
        order.id
      );
      
      return NextResponse.json({
        ...updatedOrder[0],
        mt5Response: mt5Result.data
      }, { status: 201 });
      
    } else {
      // Update order status to rejected
      const updatedOrder = await db.update(orders)
        .set({
          status: 'rejected'
        })
        .where(eq(orders.id, order.id))
        .returning();
      
      await createAuditLog(
        'execution', 
        'order_rejected', 
        `Order ${order.id} rejected: ${mt5Result.error}`, 
        'order', 
        order.id, 
        'error'
      );
      
      return NextResponse.json({
        ...updatedOrder[0],
        error: mt5Result.error,
        code: "MT5_EXECUTION_FAILED"
      }, { status: 400 });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Order submission error:', error);
    
    await createAuditLog(
      'execution', 
      'order_submission_error', 
      `Critical error during order submission: ${errorMessage}`, 
      undefined, 
      undefined, 
      'error'
    );
    
    return NextResponse.json({
      error: 'Internal server error: ' + errorMessage,
      code: "INTERNAL_ERROR"
    }, { status: 500 });
  }
}