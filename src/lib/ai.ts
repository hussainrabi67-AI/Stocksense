import { getSupabaseCredentials, getSupabase } from './supabase';
import { getStockChangeRequestById, confirmStockChangeRequest, cancelStockChangeRequest } from './api';
import { UserRole, StockChangeRequest, Product } from '../types/inventory';

export interface AIResponse {
  message: string;
  source: 'n8n';
  confirmationRequest?: StockChangeRequest;
  productCard?: Partial<Product>;
  error?: boolean;
}

// Conversation Session ID tracking
export function resetConversationId(userId: string = 'user'): string {
  const newCid = `conv-${userId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem('stocksense_conversation_id', newCid);
      window.localStorage?.setItem('stocksense_conversation_id', newCid);
    } catch (e) {}
  }
  return newCid;
}

export function getConversationId(userId: string = 'user'): string {
  if (typeof window !== 'undefined') {
    try {
      const fromSession = window.sessionStorage?.getItem('stocksense_conversation_id');
      if (fromSession) return fromSession;
      const fromLocal = window.localStorage?.getItem('stocksense_conversation_id');
      if (fromLocal) return fromLocal;
    } catch (e) {}
    const newCid = resetConversationId(userId);
    return newCid;
  }
  return `conv-${userId}-${Date.now().toString(36)}`;
}

// Pending Stock Change Request ID tracking
let activePendingRequestId: string | null = null;

export function getPendingRequestId(): string | null {
  if (activePendingRequestId) return activePendingRequestId;
  if (typeof window !== 'undefined') {
    try {
      const fromSession = window.sessionStorage?.getItem('stocksense_pending_request_id');
      if (fromSession) {
        activePendingRequestId = fromSession;
        return fromSession;
      }
      const fromLocal = window.localStorage?.getItem('stocksense_pending_request_id');
      if (fromLocal) {
        activePendingRequestId = fromLocal;
        return fromLocal;
      }
    } catch (e) {}
  }
  return null;
}

export function setPendingRequestId(id: string | null): void {
  activePendingRequestId = id;
  if (typeof window !== 'undefined') {
    try {
      if (id) {
        window.sessionStorage?.setItem('stocksense_pending_request_id', id);
        window.localStorage?.setItem('stocksense_pending_request_id', id);
      } else {
        window.sessionStorage?.removeItem('stocksense_pending_request_id');
        window.localStorage?.removeItem('stocksense_pending_request_id');
      }
    } catch (e) {}
  }
}

function appendRequestIdToUrl(url: string, reqId?: string | null): string {
  if (!reqId) return url;
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('request_id', reqId);
    urlObj.searchParams.set('requestId', reqId);
    return urlObj.toString();
  } catch (e) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}request_id=${encodeURIComponent(reqId)}&requestId=${encodeURIComponent(reqId)}`;
  }
}

/**
 * Recursively search any n8n data structure for a real request_id or requestId.
 */
function findRequestId(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return findRequestId(JSON.parse(trimmed));
      } catch (e) {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(obj)) {
    for (let i = obj.length - 1; i >= 0; i--) {
      const found = findRequestId(obj[i]);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === 'object') {
    const directKeys = [
      'request_id',
      'requestId',
      'requestID',
      'pending_request_id',
      'pendingRequestId',
      'stock_change_request_id'
    ];
    for (const k of directKeys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        const val = String(obj[k]).trim();
        if (val && val !== 'null' && val !== 'undefined') return val;
      }
    }

    // Check id if it is a valid UUID or starts with req-
    if (obj.id !== undefined && obj.id !== null) {
      const val = String(obj.id).trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || val.startsWith('req-')) {
        return val;
      }
    }

    if (obj.json) {
      const found = findRequestId(obj.json);
      if (found) return found;
    }
    if (obj.confirmationRequest) {
      const found = findRequestId(obj.confirmationRequest);
      if (found) return found;
    }
    if (obj.body) {
      const found = findRequestId(obj.body);
      if (found) return found;
    }
    if (obj.data) {
      const found = findRequestId(obj.data);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Robust extractor for n8n AI agent and webhook responses.
 * Extracts the real reply message, request_id, and status=PENDING.
 */
function extractN8nResponse(data: any): {
  message: string | null;
  confirmationRequest?: StockChangeRequest;
  productCard?: any;
} {
  if (data === null || data === undefined) return { message: null };

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return { message: null };
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractN8nResponse(parsed);
      } catch (e) {
        return { message: trimmed };
      }
    }
    return { message: trimmed };
  }

  // If data is an array of items (standard in n8n execution items list)
  if (Array.isArray(data)) {
    if (data.length === 0) return { message: null };
    // Process from newest (last) item backwards
    for (let i = data.length - 1; i >= 0; i--) {
      const item = data[i];
      const parsed = extractN8nResponse(item);
      if (parsed.message || parsed.confirmationRequest) return parsed;
    }
    return { message: null };
  }

  if (typeof data === 'object') {
    // Thoroughly search for real request_id across top-level and nested properties
    const realRequestId = findRequestId(data);

    let confirmationRequest: StockChangeRequest | undefined = undefined;
    if (realRequestId) {
      // Immediately store found realRequestId
      setPendingRequestId(realRequestId);

      confirmationRequest = {
        id: realRequestId,
        status: data.status || 'PENDING',
        product_name:
          data.product_name ||
          data.productName ||
          data.product ||
          data.confirmationRequest?.product_name ||
          'Inventory Item',
        product_id: data.product_id || data.productId || data.confirmationRequest?.product_id || '',
        movement_type:
          data.movement_type ||
          data.movementType ||
          data.confirmationRequest?.movement_type ||
          'IN',
        quantity: Math.abs(data.quantity ?? data.confirmationRequest?.quantity ?? 1),
        expected_quantity:
          data.expected_quantity ??
          data.current_stock ??
          data.before ??
          data.confirmationRequest?.expected_quantity,
        resulting_quantity:
          data.resulting_quantity ??
          data.resulting_stock ??
          data.after ??
          data.confirmationRequest?.resulting_quantity,
        reason: data.reason || data.confirmationRequest?.reason || 'Stock change operation',
        supplier_name: data.supplier_name || data.supplierName || data.confirmationRequest?.supplier_name,
        source: data.source || data.confirmationRequest?.source || 'AI_ASSISTANT',
        expected_version: data.expected_version || data.confirmationRequest?.expected_version || 1,
        expires_at: data.expires_at || data.confirmationRequest?.expires_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    // Standard n8n { json: ... }
    if (data.json && typeof data.json === 'object') {
      const parsedJson = extractN8nResponse(data.json);
      if (parsedJson.message || parsedJson.confirmationRequest) {
        return {
          message: parsedJson.message,
          confirmationRequest: parsedJson.confirmationRequest || confirmationRequest,
          productCard: parsedJson.productCard || data.productCard
        };
      }
    }

    // Direct property candidates commonly emitted by n8n agents
    const candidateKeys = [
      'reply',
      'output',
      'message',
      'text',
      'response',
      'answer',
      'result',
      'content',
      'data',
      'msg'
    ];

    for (const key of candidateKeys) {
      if (data[key] !== undefined && data[key] !== null) {
        const val = data[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          const trimmed = val.trim();
          if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
          ) {
            try {
              const nested = JSON.parse(trimmed);
              const extracted = extractN8nResponse(nested);
              if (extracted.message || extracted.confirmationRequest) {
                return {
                  message: extracted.message,
                  confirmationRequest: extracted.confirmationRequest || confirmationRequest,
                  productCard: extracted.productCard || data.productCard
                };
              }
            } catch (e) {
              // Not valid json, continue as text
            }
          }
          return {
            message: trimmed,
            confirmationRequest: confirmationRequest,
            productCard: data.productCard
          };
        } else if (typeof val === 'object') {
          const extracted = extractN8nResponse(val);
          if (extracted.message || extracted.confirmationRequest) {
            return {
              message: extracted.message,
              confirmationRequest: extracted.confirmationRequest || confirmationRequest,
              productCard: extracted.productCard || data.productCard
            };
          }
        }
      }
    }

    if (confirmationRequest || data.productCard) {
      return {
        message: data.message || data.reply || 'Please review and confirm the stock change request below:',
        confirmationRequest: confirmationRequest,
        productCard: data.productCard
      };
    }
  }

  return { message: null };
}

/**
 * Send the user's exact question to n8n and display the actual n8n response.
 * If a pending request exists, ALWAYS sends request_id with the message.
 */
export async function sendAIMessage(
  query: string,
  user: { id: string; name: string; role: UserRole },
  conversationId?: string,
  explicitRequestId?: string
): Promise<AIResponse> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      message: 'Please enter your inventory question or stock operation instruction.',
      source: 'n8n'
    };
  }

  const { n8nUrl, hasN8n } = getSupabaseCredentials();

  if (!hasN8n || !n8nUrl) {
    return {
      message: 'AI Assistant is temporarily unavailable.',
      source: 'n8n',
      error: true
    };
  }

  // Retrieve current authenticated Supabase session access_token
  let accessToken: string | null = null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (!sessionErr && sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
    } catch (err) {
      console.warn('Failed to retrieve Supabase session access_token:', err);
    }
  }

  const activeConversationId = conversationId || getConversationId(user.id);
  const pendingRequestId = explicitRequestId || getPendingRequestId();

  // Try the configured endpoint first, fallback to alternate if 404
  const candidateUrls: string[] = [n8nUrl];
  if (n8nUrl.includes('/webhook-test/')) {
    candidateUrls.push(n8nUrl.replace('/webhook-test/', '/webhook/'));
  } else if (n8nUrl.includes('/webhook/')) {
    candidateUrls.push(n8nUrl.replace('/webhook/', '/webhook-test/'));
  }

  // Construct exact payload for n8n
  const payload: Record<string, any> = {
    message: cleanQuery,
    query: cleanQuery,
    chatInput: cleanQuery,
    input: cleanQuery,
    question: cleanQuery,
    userId: user.id,
    role: user.role,
    userName: user.name,
    conversationId: activeConversationId,
    sessionId: activeConversationId,
    chatId: activeConversationId,
    accessToken: accessToken,
    user: {
      id: user.id,
      name: user.name,
      role: user.role
    },
    mallContext: 'Nowshera Shopping Mall, GT Road Nowshera'
  };

  // When a pending request exists, ALWAYS send request_id in all standard field formats
  if (pendingRequestId) {
    payload.request_id = pendingRequestId;
    payload.requestId = pendingRequestId;
    payload.requestID = pendingRequestId;
    payload.id = pendingRequestId;
    payload.body = {
      request_id: pendingRequestId,
      requestId: pendingRequestId,
      id: pendingRequestId,
      message: cleanQuery
    };
    payload.data = {
      request_id: pendingRequestId,
      requestId: pendingRequestId,
      id: pendingRequestId
    };

    // If query is a confirmation intent, set action/status explicitly
    if (/(?:confirm|yes|proceed|approve|agree|ok)/i.test(cleanQuery)) {
      payload.action = 'CONFIRM';
      payload.status = 'CONFIRMED';
      payload.body.action = 'CONFIRM';
      payload.data.action = 'CONFIRM';
    }
  }

  for (const targetUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const finalUrl = appendRequestIdToUrl(targetUrl, pendingRequestId);
      const response = await fetch(finalUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          ...(pendingRequestId ? { 'x-request-id': pendingRequestId, 'X-Request-Id': pendingRequestId } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const rawText = await response.text();
        let data: any = null;

        if (rawText && rawText.trim()) {
          try {
            data = JSON.parse(rawText);
          } catch (e) {
            // Plain text or markdown response directly from n8n
            return {
              message: rawText.trim(),
              source: 'n8n'
            };
          }
        }

        if (data !== null) {
          const parsed = extractN8nResponse(data);
          if (parsed.message || parsed.confirmationRequest) {
            // If n8n returned a PENDING stock-change response, store its real request_id
            if (parsed.confirmationRequest?.id) {
              const realId = parsed.confirmationRequest.id;
              setPendingRequestId(realId);

              // Ensure Current Stock (expected_quantity), Change (quantity), and Proposed Stock (resulting_quantity)
              if (
                parsed.confirmationRequest.expected_quantity === undefined ||
                parsed.confirmationRequest.resulting_quantity === undefined ||
                !parsed.confirmationRequest.product_name ||
                parsed.confirmationRequest.product_name === 'Inventory Item'
              ) {
                try {
                  const dbReq = await getStockChangeRequestById(realId);
                  if (dbReq) {
                    parsed.confirmationRequest = {
                      ...dbReq,
                      ...parsed.confirmationRequest,
                      id: realId, // Strictly preserve real request_id
                      status: 'PENDING',
                      product_name: dbReq.product_name || parsed.confirmationRequest.product_name,
                      expected_quantity: dbReq.expected_quantity,
                      quantity: dbReq.quantity,
                      resulting_quantity: dbReq.resulting_quantity,
                      movement_type: dbReq.movement_type
                    };
                  }
                } catch (e) {
                  console.warn('Could not populate DB fields for stock request:', e);
                }
              }
            }

            return {
              message: parsed.message || 'Please review and confirm the stock change request below:',
              source: 'n8n',
              confirmationRequest: parsed.confirmationRequest,
              productCard: parsed.productCard
            };
          }
        }

        // If n8n responded HTTP 200 with an unparsable/empty body
        return {
          message: 'AI Assistant is temporarily unavailable.',
          source: 'n8n',
          error: true
        };
      } else if (response.status === 404) {
        // Try fallback candidate URL if test endpoint is closed
        continue;
      } else {
        console.warn('n8n Webhook returned HTTP error:', response.status);
      }
    } catch (err: any) {
      console.warn('n8n Webhook connection failed or timed out:', targetUrl, err?.message || err);
    }
  }

  // When n8n is unavailable or errors out, always return standard unavailable message
  return {
    message: 'AI Assistant is temporarily unavailable.',
    source: 'n8n',
    error: true
  };
}

/**
 * Confirmation must send the stored request_id and current Supabase accessToken to n8n.
 * Never calls Prepare Stock Change again.
 */
export async function confirmStockChangeViaN8n(
  requestId: string,
  user: { id: string; name: string; role: UserRole }
): Promise<boolean> {
  if (!requestId) {
    throw new Error('No pending request_id to confirm.');
  }

  // Store/sync pending request_id
  setPendingRequestId(requestId);

  // 1. Get current authenticated Supabase session access_token
  let accessToken: string | null = null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
    } catch (err) {
      console.warn('Failed to retrieve Supabase session access_token:', err);
    }
  }

  const { n8nUrl, hasN8n } = getSupabaseCredentials();

  // 2. Notify n8n of confirmation with stored request_id and accessToken
  if (hasN8n && n8nUrl) {
    const candidateUrls: string[] = [n8nUrl];
    if (n8nUrl.includes('/webhook-test/')) {
      candidateUrls.push(n8nUrl.replace('/webhook-test/', '/webhook/'));
    } else if (n8nUrl.includes('/webhook/')) {
      candidateUrls.push(n8nUrl.replace('/webhook/', '/webhook-test/'));
    }

    const convId = getConversationId(user.id);

    const confirmPayload = {
      message: 'Confirm',
      query: 'Confirm',
      chatInput: 'Confirm',
      input: 'Confirm',
      action: 'CONFIRM',
      status: 'CONFIRMED',
      request_id: requestId,
      requestId: requestId,
      requestID: requestId,
      id: requestId,
      body: {
        request_id: requestId,
        requestId: requestId,
        id: requestId,
        action: 'CONFIRM',
        message: 'Confirm'
      },
      data: {
        request_id: requestId,
        requestId: requestId,
        id: requestId,
        action: 'CONFIRM'
      },
      accessToken: accessToken,
      userId: user.id,
      role: user.role,
      userName: user.name,
      conversationId: convId,
      sessionId: convId,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      mallContext: 'Nowshera Shopping Mall, GT Road Nowshera'
    };

    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const finalUrl = appendRequestIdToUrl(targetUrl, requestId);
        await fetch(finalUrl, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
            'x-request-id': requestId,
            'X-Request-Id': requestId
          },
          body: JSON.stringify(confirmPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        break;
      } catch (err) {
        console.warn('Could not notify n8n of confirmation:', err);
      }
    }
  }

  // 3. Call existing confirmation endpoint to finalize in Supabase
  // (Never calls Prepare Stock Change again)
  await confirmStockChangeRequest(requestId);

  // 4. Clear stored pending request_id
  setPendingRequestId(null);

  return true;
}

/**
 * Cancel clears the pending request without changing inventory.
 */
export async function cancelStockChangeViaN8n(
  requestId: string,
  user: { id: string; name: string; role: UserRole }
): Promise<boolean> {
  if (!requestId) return true;

  let accessToken: string | null = null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
    } catch (err) {
      console.warn('Failed to retrieve Supabase session access_token:', err);
    }
  }

  const { n8nUrl, hasN8n } = getSupabaseCredentials();

  // Notify n8n of cancellation if configured
  if (hasN8n && n8nUrl) {
    const candidateUrls: string[] = [n8nUrl];
    if (n8nUrl.includes('/webhook-test/')) {
      candidateUrls.push(n8nUrl.replace('/webhook-test/', '/webhook/'));
    } else if (n8nUrl.includes('/webhook/')) {
      candidateUrls.push(n8nUrl.replace('/webhook/', '/webhook-test/'));
    }

    const convId = getConversationId(user.id);

    const cancelPayload = {
      message: 'Cancel',
      query: 'Cancel',
      chatInput: 'Cancel',
      input: 'Cancel',
      action: 'CANCEL',
      status: 'CANCELLED',
      request_id: requestId,
      requestId: requestId,
      requestID: requestId,
      id: requestId,
      body: {
        request_id: requestId,
        requestId: requestId,
        id: requestId,
        action: 'CANCEL',
        message: 'Cancel'
      },
      data: {
        request_id: requestId,
        requestId: requestId,
        id: requestId,
        action: 'CANCEL'
      },
      accessToken: accessToken,
      userId: user.id,
      role: user.role,
      userName: user.name,
      conversationId: convId,
      sessionId: convId
    };

    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        await fetch(targetUrl, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify(cancelPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        break;
      } catch (err) {
        console.warn('Could not notify n8n of cancellation:', err);
      }
    }
  }

  // Cancel clears the pending request without changing inventory
  await cancelStockChangeRequest(requestId);
  setPendingRequestId(null);

  return true;
}
