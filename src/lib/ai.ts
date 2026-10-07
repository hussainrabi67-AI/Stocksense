import {
  getStockChangeRequestById,
  confirmStockChangeRequest,
  cancelStockChangeRequest,
  prepareStockChangeRequest,
  getProducts,
  getSuppliers,
  getLowStockProducts,
  getMovementHistory,
  getTopSellingProducts,
  getProductById
} from './api';
import { getSupabaseCredentials } from './supabase';
import { UserRole, StockChangeRequest, Product } from '../types/inventory';

export interface AIResponse {
  message: string;
  source: 'supabase' | 'n8n';
  confirmationRequest?: StockChangeRequest;
  productCard?: Partial<Product>;
  error?: boolean;
}

/**
 * Human-friendly name formatter:
 * Extracts pleasant first name (e.g. 'hussainrabi67' -> 'Hussain', 'Tariq Khan' -> 'Tariq')
 */
export function getHumanName(name?: string, email?: string): string {
  const target = (name && name !== 'user' && name !== 'demo-user' && name !== 'popup-user' && name !== 'Mall Staff')
    ? name
    : (email || '');
  if (!target) return 'there';

  const cleaned = target.split('@')[0].replace(/[0-9_.-]+/g, ' ').trim();
  if (!cleaned) return 'there';

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : 'there';
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

function findBestMatchingProduct(query: string, products: Product[]): Product | null {
  if (!query || !products || products.length === 0) return null;
  const cleanQ = query.toLowerCase().trim();

  // 1. Direct SKU match
  for (const prod of products) {
    const sku = prod.sku.toLowerCase();
    if (cleanQ.includes(sku) || (cleanQ.length >= 4 && sku.includes(cleanQ))) {
      return prod;
    }
  }

  // 2. Direct exact or substring match on product name
  for (const prod of products) {
    const pName = prod.name.toLowerCase();
    if (cleanQ.includes(pName) || (cleanQ.length >= 3 && pName.includes(cleanQ))) {
      return prod;
    }
  }

  // 3. Normalized keyword match
  const stopWords = new Set([
    'stock', 'in', 'out', 'add', 'remove', 'receive', 'deduct', 'please', 'the',
    'from', 'for', 'units', 'unit', 'pieces', 'pcs', 'items', 'item', 'boxes',
    'how', 'many', 'much', 'have', 'check', 'what', 'do', 'we', 'today', 'to',
    'confirm', 'confirmed', 'cancel', 'and', 'with', 'about', 'can', 'you',
    'price', 'cost', 'buying', 'selling', 'tell', 'show', 'give'
  ]);

  const queryWords = cleanQ
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));

  let bestProd: Product | null = null;
  let bestScore = 0;

  for (const prod of products) {
    const prodWords = `${prod.name} ${prod.sku} ${prod.category_name || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    let matchCount = 0;
    for (const qw of queryWords) {
      if (prodWords.some((pw) => pw.includes(qw) || qw.includes(pw))) {
        matchCount++;
      }
    }

    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestProd = prod;
    }
  }

  return bestScore > 0 ? bestProd : null;
}

/**
 * Extract positive quantity integer from user command
 */
function extractQuantity(query: string): number | null {
  const verbMatch = query.match(/(?:stock\s*(?:in|out)|add|receive|remove|deduct|take\s*out|sell|sale|sales|inbound|outbound|put)\s+(\d+)\b/i);
  if (verbMatch && verbMatch[1]) {
    const val = parseInt(verbMatch[1], 10);
    if (val > 0) return val;
  }

  const unitMatch = query.match(/\b(\d+)\s*(?:units?|pieces?|pcs?|items?|adapters?|cables?|chargers?|mice?|mouse|keyboards?|banks?)\b/i);
  if (unitMatch && unitMatch[1]) {
    const val = parseInt(unitMatch[1], 10);
    if (val > 0) return val;
  }

  const genericMatch = query.match(/\b(\d+)\b/);
  if (genericMatch && genericMatch[1]) {
    const val = parseInt(genericMatch[1], 10);
    if (val > 0) return val;
  }

  return null;
}

/**
 * Clean item candidate string by trimming stop words and query suffixes
 */
function cleanItemCandidate(raw: string): string {
  return raw
    .replace(/^(?:a|an|the|any|some)\s+/i, '')
    .replace(/\s+(?:available\s+in\s+(?:the\s+)?list|in\s+(?:the\s+)?list|available|in\s*stock|in\s+store|on\s+hand|please|today|now)$/i, '')
    .replace(/[?!.]+$/, '')
    .trim();
}

/**
 * Extract targeted item/product name from natural language query
 */
export function extractQueriedItemName(query: string): string | null {
  const clean = query.trim().replace(/[?!.]+$/, '').trim();

  // 1. "Is [Item] available in the list?" / "Is [Item] in the list?" / "Is [Item] available?" / "Are [Item] in stock?"
  const isMatch = clean.match(/^(?:is|are|check\s+if)\s+(?:there\s+any\s+|a\s+|an\s+|the\s+)?(.+?)\s+(?:available\s+in\s+(?:the\s+)?list|in\s+(?:the\s+)?list|available|in\s*stock|in\s+store|on\s+hand)$/i);
  if (isMatch && isMatch[1]) {
    const cleaned = cleanItemCandidate(isMatch[1]);
    if (cleaned.length > 1) return cleaned;
  }

  // 2. "Do we have [Item]?" / "Do you have [Item]?" / "Have we got [Item]?"
  const haveMatch = clean.match(/(?:do\s*we\s*have|do\s*you\s*have|have\s*we\s*got|got\s*any)\s+(?:a\s+|an\s+|the\s+|any\s+)?(.+?)(?:\s+(?:available|in\s+stock|in\s+(?:the\s+)?list|in\s+store|on\s+hand))?$/i);
  if (haveMatch && haveMatch[1]) {
    const cleaned = cleanItemCandidate(haveMatch[1]);
    if (cleaned.length > 1) return cleaned;
  }

  // 3. "Check stock of [Item]" / "Stock of [Item]" / "Price of [Item]" / "Cost of [Item]" / "Margin of [Item]"
  const ofMatch = clean.match(/(?:check\s*(?:the\s*)?stock\s*(?:of|for)?|stock\s*(?:of|for)|availability\s*(?:of|for)|price\s*(?:of|for)|cost\s*(?:of|for)|margin\s*(?:of|for)|how\s*many(?:\s+units\s*of)?)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+(?:available|in\s+stock|in\s+(?:the\s+)?list|do\s+we\s+have))?$/i);
  if (ofMatch && ofMatch[1]) {
    const cleaned = cleanItemCandidate(ofMatch[1]);
    if (cleaned.length > 1) return cleaned;
  }

  // 4. "Stock in 20 [Item]" / "Stock out 5 [Item]"
  const stockMoveMatch = clean.match(/(?:stock\s*(?:in|out)|add|remove|deduct|receive)\s+\d+\s*(?:units?\s*(?:of\s*)?)?(.+?)(?:\s+(?:from|to|into|please))?$/i);
  if (stockMoveMatch && stockMoveMatch[1]) {
    const cleaned = cleanItemCandidate(stockMoveMatch[1]);
    if (cleaned.length > 1) return cleaned;
  }

  // 5. "Lookup [Item]" / "Search [Item]" / "Find [Item]"
  const searchMatch = clean.match(/(?:lookup|search(?:\s+for)?|find|show\s+me)\s+(?:a\s+|an\s+|the\s+)?(.+?)$/i);
  if (searchMatch && searchMatch[1]) {
    const cleaned = cleanItemCandidate(searchMatch[1]);
    if (cleaned.length > 1) return cleaned;
  }

  return null;
}

/**
 * Communicates with n8n AI agent webhook workflow
 */
export async function callN8nAIWebhook(
  query: string,
  user: { id: string; name: string; role: UserRole },
  conversationId?: string
): Promise<AIResponse | null> {
  const { n8nUrl, hasN8n } = getSupabaseCredentials();
  if (!hasN8n || !n8nUrl) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const convId = conversationId || getConversationId(user.id);
    const payload = {
      message: query,
      query: query,
      chatInput: query,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      role: user.role,
      conversationId: convId,
      sessionId: convId,
      timestamp: new Date().toISOString()
    };

    const response = await fetch('/api/ai/n8n-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`n8n webhook returned status ${response.status}`);
      return null;
    }

    const text = await response.text();
    if (!text || !text.trim()) return null;

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        message: text.trim(),
        source: 'n8n'
      };
    }

    if (Array.isArray(data) && data.length > 0) {
      data = data[0];
    }

    const messageText =
      data.message ||
      data.output ||
      data.text ||
      data.response ||
      (typeof data === 'string' ? data : null);

    if (messageText) {
      return {
        message: messageText,
        source: 'n8n',
        confirmationRequest: data.confirmationRequest || data.confirmation_request,
        productCard: data.productCard || data.product_card,
        error: Boolean(data.error)
      };
    }

    return null;
  } catch (err: any) {
    console.warn('n8n AI webhook communication caught:', err?.message || err);
    return null;
  }
}

/**
 * Internal Shopping Mall Management Assistant:
 * - Operates for Admin, Manager, and Staff roles.
 * - Communicates with n8n AI webhook when configured.
 * - Uses real database data exclusively with deterministic, consistent replies.
 * - Enforces role-based permissions: Staff cannot view cost prices, profit margins, or perform unauthorized tasks.
 * - Resists prompt-injection attacks: Backend session role is the sole authority.
 * - Records every confirmed change in stock history with user name and action.
 * - Natural, human-like responses with zero infrastructure exposure.
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
      message: 'Just let me know what inventory item you would like to check or update (for example: "Stock in 20 Type-C Cables" or "Check stock of Wireless Mouse").',
      source: 'supabase'
    };
  }

  // Check if user is asking about n8n webhook connection status
  if (/(?:is|test|check|verify)\s+n8n(?:\s+connected|\s+status|\s+webhook)?\b/i.test(cleanQuery)) {
    const creds = getSupabaseCredentials();
    if (creds.hasN8n) {
      return {
        message: `🤖 **n8n AI Webhook**: Connected & Active\n\n• **Endpoint**: \`${creds.n8nUrl}\`\n• **Status**: Live\n\nIncoming queries are forwarded to your n8n AI workflow.`,
        source: 'n8n'
      };
    } else {
      return {
        message: `ℹ️ **n8n AI Webhook**: Not currently connected.\n\nThe AI Agent is running via the built-in database copilot engine. To connect an external n8n workflow, an Administrator can enter the Webhook URL in **Settings** or the connection modal.`,
        source: 'supabase'
      };
    }
  }

  // STRICT BACKEND AUTHORIZATION:
  // Role is always derived strictly from authenticated user context, never from query text.
  const effectiveRole: UserRole = user.role;
  const humanName = getHumanName(user.name);
  const activeReqId = explicitRequestId || getPendingRequestId();

  // ==============================================================================
  // 1. PROMPT INJECTION & ROLE SPOOFING DEFENSE
  // ==============================================================================
  const isPromptInjectionAttempt = /(?:i\s*am\s*(?:the\s*)?(?:manager|admin|administrator|owner|supervisor|boss)|act\s*as\s*(?:the\s*)?(?:manager|admin)|as\s*a\s*manager|pretend\s*(?:you\s*are|to\s*be)|bypass\s*permissions|ignore\s*(?:all\s*)?previous|grant\s*me\s*(?:admin|manager))/i.test(cleanQuery);

  // If a Staff member attempts role injection:
  if (effectiveRole === 'STAFF' && isPromptInjectionAttempt) {
    const isAskingFinancials = /(?:cost|buying|purchase|wholesale|profit|margin|markup)/i.test(cleanQuery);
    if (isAskingFinancials) {
      return {
        message: `Your active system login is **Staff**. Permissions are strictly governed by backend authentication and cannot be changed through conversation.\n\nFinancial cost prices, wholesale rates, and profit margins are confidential and accessible only to verified Store Managers and Administrators.`,
        source: 'supabase'
      };
    }
    return {
      message: `Your active system session is logged in as **Staff**. Operational permissions are enforced by backend authentication and cannot be elevated via chat.\n\nAs Staff, you can look up inventory quantities and retail prices, or record incoming shipments (**Stock In**) and stock deductions (**Stock Out**).`,
      source: 'supabase'
    };
  }

  // ==============================================================================
  // 2. CANCELLATION INTENT (Checked first to prevent accidental confirmation)
  // ==============================================================================
  const isCancelIntent = /(?:cancel|cancelled|abort|reject|dismiss|no|stop|decline)\b/i.test(cleanQuery);
  if (isCancelIntent) {
    if (activeReqId) {
      try {
        await cancelStockChangeRequest(activeReqId);
      } catch (err: any) {
        // ignore
      }
    }
    setPendingRequestId(null);
    return {
      message: `No problem, I have cancelled that stock update request. The inventory numbers were not changed.`,
      source: 'supabase'
    };
  }

  // ==============================================================================
  // 3. CONFIRMATION INTENT: Direct Execution & Audit Logging
  // ==============================================================================
  const isConfirmIntent =
    !isCancelIntent &&
    (/(?:confirmed|confirm|yes|proceed|approve|agree|ok|done|apply)\b/i.test(cleanQuery) ||
      cleanQuery.toLowerCase().includes('confirmed request_id') ||
      Boolean(explicitRequestId));

  if (isConfirmIntent && activeReqId) {
    try {
      const reqDetails = await getStockChangeRequestById(activeReqId);
      const confirmKey = `ai-confirm-${activeReqId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Pass authenticated performer to record immutable audit trail
      await confirmStockChangeRequest(activeReqId, confirmKey, { id: user.id, name: user.name });
      setPendingRequestId(null);

      let updatedProd: Product | null = null;
      if (reqDetails?.product_id) {
        updatedProd = await getProductById(reqDetails.product_id, effectiveRole);
      }

      const prodName = updatedProd?.name || reqDetails?.product_name || 'Inventory Item';
      const movType = reqDetails?.movement_type || 'IN';
      const qty = reqDetails?.quantity || 0;
      const beforeQty = reqDetails?.expected_quantity ?? 0;
      const afterQty = updatedProd?.quantity_on_hand ?? reqDetails?.resulting_quantity ?? (movType === 'IN' ? beforeQty + qty : beforeQty - qty);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('stocksense:inventory_updated'));
      }

      return {
        message: `All set! The stock count for **${prodName}** has been updated successfully:\n\n• **Operation**: Stock ${movType === 'IN' ? 'In (Inbound)' : 'Out (Dispatch)'}\n• **Units moved**: ${qty} units\n• **Previous Stock**: ${beforeQty} units\n• **New Stock on Hand**: **${afterQty} units**\n• **Recorded in Stock History**: Action logged under **${user.name}**\n\nThe store inventory records are now up to date.`,
        source: 'supabase'
      };
    } catch (err: any) {
      return {
        message: `Sorry, we could not complete the stock confirmation: ${err.message || 'Please check your connection and try again.'}`,
        source: 'supabase',
        error: true
      };
    }
  }

  // ==============================================================================
  // 4. n8n AI WEBHOOK ORCHESTRATION (If configured)
  // ==============================================================================
  const creds = getSupabaseCredentials();
  if (creds.hasN8n) {
    const n8nResult = await callN8nAIWebhook(cleanQuery, user, conversationId);
    if (n8nResult && n8nResult.message) {
      if (n8nResult.confirmationRequest?.id) {
        setPendingRequestId(n8nResult.confirmationRequest.id);
      }
      return n8nResult;
    }
  }

  // ==============================================================================
  // 5. ROLE PERMISSION ENFORCEMENT: Financial & Administrative Inquiries
  // ==============================================================================
  const isFinancialCostQuery = /(?:cost\s*price|buying\s*price|purchase\s*(?:price|rate)|wholesale|profit\s*margin|profit\b|margin\b|markup|how\s*much\s*did\s*we\s*pay)/i.test(cleanQuery);

  if (isFinancialCostQuery) {
    // STAFF: Strictly prohibited from viewing cost price, profit, and margin
    if (effectiveRole === 'STAFF') {
      return {
        message: `Cost prices, wholesale purchase rates, and profit margins are confidential and restricted to Store Managers and Administrators.\n\nAs Staff, you can view retail selling prices and current stock levels on hand, or record incoming deliveries and customer sales.`,
        source: 'supabase'
      };
    }

    // MANAGER / ADMIN: Provided with real financial metrics from database
    try {
      const allProducts = await getProducts(effectiveRole);
      const matched = findBestMatchingProduct(cleanQuery, allProducts);

      if (matched && matched.cost_price !== undefined) {
        const costVal = matched.cost_price * matched.quantity_on_hand;
        const retailVal = matched.selling_price * matched.quantity_on_hand;
        const potentialProfit = retailVal - costVal;

        return {
          message: `📊 **Financial & Profit Margin Details:**\n\n• **Product**: **${matched.name}** (\`${matched.sku}\`)\n• **Retail Selling Price**: PKR ${matched.selling_price.toLocaleString()}\n• **Wholesale Cost Price**: PKR ${matched.cost_price.toLocaleString()}\n• **Unit Profit Margin**: PKR ${(matched.profit || (matched.selling_price - matched.cost_price)).toLocaleString()} (${matched.profit_margin_percent}% margin)\n• **Current Stock on Hand**: ${matched.quantity_on_hand} units\n• **Stock Inventory Cost**: PKR ${costVal.toLocaleString()}\n• **Stock Retail Potential**: PKR ${retailVal.toLocaleString()} (Est. Profit: PKR ${potentialProfit.toLocaleString()})`,
          source: 'supabase',
          productCard: matched
        };
      }

      // If a specific item was asked about but not found in catalog:
      const itemAttempt = extractQueriedItemName(cleanQuery);
      const isAskingGeneralOverview = /(?:overall|general|total|all\s*products|whole\s*catalog|average)\s*(?:margins?|cost|profit)/i.test(cleanQuery);

      if (itemAttempt || !isAskingGeneralOverview) {
        const itemLabel = itemAttempt ? `**${itemAttempt}**` : 'This item';
        return {
          message: `This item is not available in the list.\n\n${itemLabel} is currently not listed in the store inventory catalog. Wholesale cost prices and profit margins can only be inspected for items in the registered catalog.`,
          source: 'supabase'
        };
      }

      // If asking about general margins across catalog
      const prodsWithCost = allProducts.filter((p) => p.cost_price !== undefined);
      const totalCost = prodsWithCost.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.quantity_on_hand || 0)), 0);
      const totalRetail = prodsWithCost.reduce((sum, p) => sum + (p.selling_price * (p.quantity_on_hand || 0)), 0);
      const avgMargin = totalRetail > 0 ? (((totalRetail - totalCost) / totalRetail) * 100).toFixed(1) : '0';

      return {
        message: `💼 **Nowshera Shopping Mall — Financial Overview:**\n\n• **Total Products Tracked**: **${allProducts.length}** SKUs\n• **Total Wholesale Inventory Investment**: PKR ${totalCost.toLocaleString()}\n• **Total Retail Inventory Value**: PKR ${totalRetail.toLocaleString()}\n• **Projected Gross Margin**: PKR ${(totalRetail - totalCost).toLocaleString()} (~${avgMargin}%)\n\nAsk about any specific product (e.g., *"What is the cost price of Wireless Mouse?"*) to see individual margins.`,
        source: 'supabase'
      };
    } catch (err: any) {
      return {
        message: `Unable to calculate financial data at the moment: ${err.message || 'Please try again.'}`,
        source: 'supabase',
        error: true
      };
    }
  }

  // Unauthorized Admin Operations (Product deletion or User role changes)
  const isUnauthorizedAdminAction = /(?:delete|drop)\s*(?:product|catalog|all\s*data)|(?:create|modify|delete|change)\s*(?:user|role|staff|admin|account|permission)/i.test(cleanQuery);
  if (isUnauthorizedAdminAction && effectiveRole !== 'ADMIN') {
    return {
      message: `Modifying catalog architecture, deleting products, or changing user roles is strictly restricted to Administrators. Your current role is **${effectiveRole === 'MANAGER' ? 'Store Manager' : 'Staff'}**.`,
      source: 'supabase'
    };
  }

  // ==============================================================================
  // 5. STOCK IN / STOCK OUT INTENT: Direct Database 2-Step Preparation
  // ==============================================================================
  const isStockIn = /(?:stock\s*in|add\b|receive|inbound|deposit|restock|incoming|put\s*in)/i.test(cleanQuery);
  const isStockOut = /(?:stock\s*out|remove\b|deduct|dispatch|sell\b|sale\b|sales\b|outbound|take\s*out|decrease|issue\b)/i.test(cleanQuery);

  if (isStockIn || isStockOut) {
    try {
      const [allProducts, allSuppliers] = await Promise.all([
        getProducts(effectiveRole),
        getSuppliers()
      ]);

      const extractedItemName = extractQueriedItemName(cleanQuery);
      let matchedProduct = extractedItemName ? findBestMatchingProduct(extractedItemName, allProducts) : null;
      if (!matchedProduct) {
        matchedProduct = findBestMatchingProduct(cleanQuery, allProducts);
      }
      const extractedQty = extractQuantity(cleanQuery);

      if (!matchedProduct) {
        const itemAttempt = extractQueriedItemName(cleanQuery);
        const itemLabel = itemAttempt ? `**${itemAttempt}**` : 'This item';
        return {
          message: `This item is not available in the list.\n\n${itemLabel} was not found in the store inventory catalog, so Stock ${isStockIn ? 'In' : 'Out'} cannot be performed.\n\nPlease select an item from the registered inventory list or ask an Administrator to add it to the catalog.`,
          source: 'supabase',
          error: true
        };
      }

      if (!extractedQty || extractedQty <= 0) {
        return {
          message: `Please specify the number of units for **${matchedProduct.name}** (for example: *"Stock ${isStockIn ? 'in' : 'out'} 25 ${matchedProduct.sku}"*).`,
          source: 'supabase'
        };
      }

      const movementType = isStockIn ? 'IN' : 'OUT';

      // STRICT NON-NEGATIVE INVENTORY ENFORCEMENT: Prohibit any stock deduction greater than on-hand quantity
      if (movementType === 'OUT' && matchedProduct.quantity_on_hand < extractedQty) {
        return {
          message: `🚫 **Stock Out Prohibited: Insufficient Inventory**\n\nStock cannot go into negative balance.\n\n• **Product**: **${matchedProduct.name}** (\`${matchedProduct.sku}\`)\n• **Current Stock on Hand**: **${matchedProduct.quantity_on_hand} units**\n• **Requested Outbound / Sale**: **${extractedQty} units**\n• **Shortage**: **${extractedQty - matchedProduct.quantity_on_hand} units**\n\nAction blocked: You cannot dispatch or sell ${extractedQty} units when only ${matchedProduct.quantity_on_hand} units exist in the inventory. Please reduce the quantity or record a Stock In shipment first.`,
          source: 'supabase',
          error: true
        };
      }

      // Match supplier if specified
      let matchedSupplierId = matchedProduct.default_supplier_id;
      for (const sup of allSuppliers) {
        if (cleanQuery.toLowerCase().includes(sup.name.toLowerCase())) {
          matchedSupplierId = sup.id;
          break;
        }
      }

      const idempotencyKey = `ai-req-${matchedProduct.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const prepRequest = await prepareStockChangeRequest({
        productId: matchedProduct.id,
        movementType,
        quantity: extractedQty,
        supplierId: matchedSupplierId,
        reason: `AI Copilot ${movementType === 'IN' ? 'Stock In' : 'Stock Out'} (${user.name})`,
        source: 'AI_ASSISTANT',
        idempotencyKey
      });

      setPendingRequestId(prepRequest.id);

      const beforeStock = matchedProduct.quantity_on_hand;
      const afterStock = movementType === 'IN' ? beforeStock + extractedQty : beforeStock - extractedQty;

      return {
        message: `📋 **Stock ${movementType === 'IN' ? 'In (Inbound)' : 'Out (Dispatch)'} Request Prepared**\n\n• **Product**: **${matchedProduct.name}** (\`${matchedProduct.sku}\`)\n• **Current Stock on Hand**: **${beforeStock} units**\n• **Requested ${movementType === 'IN' ? 'Addition' : 'Deduction'}**: **${extractedQty} units**\n• **New Stock After Confirmation**: **${afterStock} units**\n\nPlease verify and click **Confirm** below (or reply *"Confirm"*) to apply this update to store inventory, or reply *"Cancel"* to dismiss:`,
        confirmationRequest: {
          ...prepRequest,
          product_name: matchedProduct.name,
          expected_quantity: beforeStock,
          resulting_quantity: afterStock
        },
        source: 'supabase'
      };
    } catch (err: any) {
      return {
        message: `Sorry, I couldn't prepare that stock update: ${err.message || 'Please check the values and try again.'}`,
        source: 'supabase',
        error: true
      };
    }
  }

  // ==============================================================================
  // 6. LOW STOCK / REORDER INQUIRIES: Real Database Data
  // ==============================================================================
  if (/(?:low\s*stock|reorder|out\s*of\s*stock|critical\s*stock|depleted)/i.test(cleanQuery)) {
    try {
      const lowStockItems = await getLowStockProducts(effectiveRole);
      if (lowStockItems.length === 0) {
        return {
          message: `All inventory items are currently healthy! There are **0** items at or below their reorder threshold in the store.`,
          source: 'supabase'
        };
      }

      const list = lowStockItems.map((p) => {
        return `• **${p.name}** (\`${p.sku}\`)\n  - Current Stock: **${p.quantity_on_hand}** units (Reorder Threshold: ${p.reorder_level})\n  - Category: ${p.category_name || 'General'} | Supplier: ${p.supplier_name || 'Unassigned'}`;
      }).join('\n\n');

      return {
        message: `⚠️ **Low Stock Alert:** Found **${lowStockItems.length}** item(s) requiring restocking:\n\n${list}\n\nYou can say *"Stock in 30 ${lowStockItems[0].name}"* to prepare an inbound shipment right away.`,
        source: 'supabase'
      };
    } catch (err: any) {
      return {
        message: `Could not retrieve low stock items: ${err.message || 'Please check the Low Stock tab directly.'}`,
        source: 'supabase',
        error: true
      };
    }
  }

  // ==============================================================================
  // 7. STOCK HISTORY & AUDIT TRAIL: Real Database Movements
  // ==============================================================================
  if (/(?:movement|history|recent\s*movements?|today's\s*stock|transactions?|audit\s*log|activity)/i.test(cleanQuery)) {
    try {
      const movements = await getMovementHistory();
      if (movements.length === 0) {
        return {
          message: `No stock movements have been recorded in the store audit log yet.`,
          source: 'supabase'
        };
      }

      const recent = movements.slice(0, 5);
      const list = recent.map((m) => {
        const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const icon = m.movement_type === 'IN' ? '🟢 Stock In' : '🔴 Stock Out';
        return `• **${icon} (+/-${m.quantity} units)** — ${m.product_name} (\`${m.product_sku}\`)\n  - Shelf count: ${m.quantity_before} → **${m.quantity_after} units** | Performed by: ${m.performer_name || 'Staff'} at ${time}`;
      }).join('\n\n');

      return {
        message: `📋 **Recent Stock Movements & History:**\n\n${list}`,
        source: 'supabase'
      };
    } catch (err: any) {
      return {
        message: `Unable to fetch stock history: ${err.message || 'Please review the History tab directly.'}`,
        source: 'supabase',
        error: true
      };
    }
  }

  // ==============================================================================
  // 8. TOP-SELLING & WEEKLY SALES ANALYSIS: Real Database Movement Analytics
  // ==============================================================================
  const isTopSellingQuery =
    /(?:(?:which|what)\s+(?:item|product|stock|sku)?\s*(?:sold|was\s*sold|is\s*selling)\s+(?:the\s+)?most|(?:most\s*sold|best\s*selling|top\s*selling|top\s*seller|highest\s*(?:selling|sales)|best\s*seller|fastest\s*moving)\s*(?:item|product|stock|goods)?|(?:item|product)\s+(?:that\s+)?sold\s+(?:the\s+)?most|weekly\s*(?:sales|best\s*seller|top\s*seller)|sales\s*this\s*week)/i.test(cleanQuery);

  if (isTopSellingQuery) {
    try {
      let timeframeDays = 7;
      let timeframeLabel = 'this week';
      if (/\b(?:today|last\s*24\s*hours)\b/i.test(cleanQuery)) {
        timeframeDays = 1;
        timeframeLabel = 'today';
      } else if (/\b(?:month|last\s*30\s*days)\b/i.test(cleanQuery)) {
        timeframeDays = 30;
        timeframeLabel = 'this month';
      }

      const salesData = await getTopSellingProducts(timeframeDays, effectiveRole);

      if (!salesData.topItem || salesData.rankings.length === 0) {
        return {
          message: `No sales or outbound stock movements have been recorded ${timeframeLabel} yet.\n\nOnce items are sold or dispatched (**Stock Out**), I will track sales velocity and identify your top-selling products here.`,
          source: 'supabase'
        };
      }

      const top = salesData.topItem;
      const isLow = top.product.quantity_on_hand <= top.product.reorder_level;
      const stockStatus = isLow
        ? `⚠️ **Stock Alert**: Low stock remaining (**${top.product.quantity_on_hand} units** on hand, reorder threshold is ${top.product.reorder_level}). Consider restocking soon!`
        : `✅ **Stock Status**: Well stocked (**${top.product.quantity_on_hand} units** on hand).`;

      // Financial breakdown: strictly hidden for STAFF, visible for MANAGER and ADMIN
      const financialDetails = (effectiveRole !== 'STAFF' && top.product.cost_price !== undefined && top.grossProfit !== undefined)
        ? `\n• **Wholesale Cost**: PKR ${top.product.cost_price.toLocaleString()} / unit\n• **Unit Profit Margin**: PKR ${(top.product.profit || (top.product.selling_price - top.product.cost_price)).toLocaleString()} (${top.product.profit_margin_percent}% margin)\n• **Gross Profit from ${timeframeLabel === 'today' ? "Today's" : "This Week's"} Sales**: **PKR ${top.grossProfit.toLocaleString()}**`
        : '';

      // Leaderboard ranking of top items
      const rankingsList = salesData.rankings.slice(0, 5).map((item, idx) => {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const medal = medals[idx] || `${idx + 1}.`;
        const profitNote = (effectiveRole !== 'STAFF' && item.grossProfit !== undefined)
          ? ` (Est. Profit: PKR ${item.grossProfit.toLocaleString()})`
          : '';
        return `${medal} **${item.product.name}** (\`${item.product.sku}\`)\n   • **${item.unitsSold} units sold** | Sales Volume: PKR ${item.retailRevenue.toLocaleString()}${profitNote} | In Stock: ${item.product.quantity_on_hand} pcs`;
      }).join('\n\n');

      const performanceLine = (effectiveRole !== 'STAFF' && salesData.totalGrossProfitAll !== undefined)
        ? `• **Total Store Sales**: **${salesData.totalUnitsSoldAll.toLocaleString()} units** across ${salesData.rankings.length} products\n• **Total Retail Sales Volume**: PKR ${salesData.totalRetailRevenueAll.toLocaleString()}\n• **Total Gross Profit Realized**: PKR ${salesData.totalGrossProfitAll.toLocaleString()}`
        : `• **Total Store Sales**: **${salesData.totalUnitsSoldAll.toLocaleString()} units** across ${salesData.rankings.length} products\n• **Total Retail Sales Volume**: PKR ${salesData.totalRetailRevenueAll.toLocaleString()}`;

      const responseMessage = `🏆 **Top-Selling Item ${timeframeLabel === 'today' ? 'Today' : 'This Week'}:**\n\nThe item that sold the most ${timeframeLabel} is the **${top.product.name}** (\`${top.product.sku}\`).\n\n• **Total Units Sold**: **${top.unitsSold} units** (${top.transactionsCount} checkout transactions)\n• **Retail Selling Price**: PKR ${top.product.selling_price.toLocaleString()} / unit\n• **Total Sales Revenue**: **PKR ${top.retailRevenue.toLocaleString()}**${financialDetails}\n• ${stockStatus}\n\n📊 **Sales Leaderboard (${timeframeLabel === 'today' ? 'Today' : 'Past 7 Days'}):**\n\n${rankingsList}\n\n📈 **Overall Store Movement:**\n${performanceLine}\n\nWould you like to record a new Stock Out sale or check reorder status for any of these products?`;

      return {
        message: responseMessage,
        source: 'supabase',
        productCard: top.product
      };
    } catch (err: any) {
      return {
        message: `Unable to calculate sales rankings: ${err.message || 'Please check stock movement records.'}`,
        source: 'supabase',
        error: true
      };
    }
  }

  // ==============================================================================
  // 9. PRODUCT AVAILABILITY & STOCK LOOKUP: Real Database Search
  // ==============================================================================
  const isProductAvailabilityQuery =
    /(?:check\s*(?:the\s*)?stock|how\s*many|do\s*we\s*have|do\s*you\s*have|have\s*we\s*got|is\s+there|available|count\s*of|stock\s*(?:of|for)?|price\s*(?:of|for)?|search\s*(?:for)?|find\b|lookup|is\s+.*?\s+(?:available|in\s*stock|in\s*(?:the\s*)?list|in\s*store)|are\s+.*?\s+(?:available|in\s*stock|in\s*(?:the\s*)?list))/i.test(cleanQuery);

  if (isProductAvailabilityQuery) {
    try {
      const allProducts = await getProducts(effectiveRole);
      const matched = findBestMatchingProduct(cleanQuery, allProducts);

      if (matched) {
        const isLow = matched.quantity_on_hand <= matched.reorder_level;
        const financialSnippet = (effectiveRole !== 'STAFF' && matched.cost_price !== undefined)
          ? `\n• **Wholesale Cost**: PKR ${matched.cost_price.toLocaleString()} | **Margin**: ${matched.profit_margin_percent}%`
          : '';

        return {
          message: `📦 **Stock Availability: ${matched.name}**\n\n• **SKU**: \`${matched.sku}\`\n• **Quantity on Hand**: **${matched.quantity_on_hand}** units\n• **Status**: ${isLow ? '⚠️ **Low Stock** (Reorder threshold: ' + matched.reorder_level + ')' : '✅ Well Stocked'}\n• **Category**: ${matched.category_name || 'General'}\n• **Retail Price**: PKR ${matched.selling_price.toLocaleString()}${financialSnippet}\n\nTo update this stock, you can say: *"Stock in 20 ${matched.sku}"* or *"Stock out 5 ${matched.sku}"*.`,
          source: 'supabase',
          productCard: matched
        };
      }

      // If the queried item was not found in the catalog:
      const itemAttempt = extractQueriedItemName(cleanQuery) || cleanQuery.replace(/[?!.]+$/, '').trim();
      const itemLabel = itemAttempt ? `**${itemAttempt}**` : 'This item';
      const availableList = allProducts.map((p) => `• **${p.name}** (\`${p.sku}\`) — ${p.quantity_on_hand} units available`).join('\n');

      return {
        message: `This item is not available in the list.\n\n${itemLabel} is currently not listed in the store inventory catalog for Nowshera Shopping Mall.\n\n📦 **Currently available products in store:**\n${availableList}\n\nYou can ask about any of the items above, or an Administrator can register new inventory under the **Products** tab.`,
        source: 'supabase'
      };
    } catch (e) {
      // Fall through to overview
    }
  }

  // ==============================================================================
  // 9. STORE INVENTORY OVERVIEW / CATALOG SUMMARY
  // ==============================================================================
  if (/(?:total|inventory\s*count|overview|how\s*much\s*inventory|summary|catalog|valuation)/i.test(cleanQuery)) {
    try {
      const products = await getProducts(effectiveRole);
      const totalUnits = products.reduce((sum, p) => sum + (p.quantity_on_hand || 0), 0);
      const lowCount = products.filter((p) => p.quantity_on_hand <= p.reorder_level).length;

      if (effectiveRole !== 'STAFF') {
        const totalRetail = products.reduce((sum, p) => sum + (p.selling_price * (p.quantity_on_hand || 0)), 0);
        const totalCost = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.quantity_on_hand || 0)), 0);

        return {
          message: `📊 **Nowshera Shopping Mall — Executive Inventory Summary:**\n\n• **Active Catalog SKUs**: **${products.length}** products\n• **Total Units in Store**: **${totalUnits.toLocaleString()}** units\n• **Items Needing Reorder**: **${lowCount}** items\n• **Total Stock Valuation (Retail)**: PKR ${totalRetail.toLocaleString()}\n• **Total Stock Valuation (Cost)**: PKR ${totalCost.toLocaleString()}`,
          source: 'supabase'
        };
      }

      // Staff view: only units and items, no financial valuation
      return {
        message: `📊 **Nowshera Shopping Mall — Inventory Summary:**\n\n• **Active Products**: **${products.length}** SKUs\n• **Total Units in Store**: **${totalUnits.toLocaleString()}** units\n• **Items at Reorder Threshold**: **${lowCount}** items\n\nAsk about any item or enter a Stock In / Stock Out command anytime!`,
        source: 'supabase'
      };
    } catch (err: any) {
      // Fall through
    }
  }

  // ==============================================================================
  // 11. GREETINGS: Role-Tailored, Warm & Human
  // ==============================================================================
  if (/(?:^(?:hi|hello|hey|hiya|assalam|salam|aoa|greetings|good\s*(?:morning|afternoon|evening))\b)/i.test(cleanQuery)) {
    if (effectiveRole === 'ADMIN') {
      return {
        message: `Assalam-o-Alaikum ${humanName}! 👋 I am your **Shopping Mall Management Assistant**.\n\nAs an **Administrator**, you have full access to:\n• Record **Stock In** and **Stock Out** operations\n• Discover top-selling items (*"Which item sold the most this week?"*)\n• Inspect **Cost Prices**, wholesale rates, and profit margins\n• Review the immutable **Stock Movement Audit Log**\n• Check **Low Stock** reorder alerts and total store valuation\n\nHow can I assist you with mall operations today?`,
        source: 'supabase'
      };
    }

    if (effectiveRole === 'MANAGER') {
      return {
        message: `Assalam-o-Alaikum ${humanName}! 👋 I am your **Shopping Mall Management Assistant**.\n\nAs a **Store Manager**, you can:\n• Discover weekly sales velocity (*"Which item sold the most this week?"*)\n• Record incoming deliveries (**Stock In**) or dispatches (**Stock Out**)\n• Analyze **Profit Margins** and total inventory valuation\n• Review **Low Stock** items and supplier shipments\n• Check today's stock movement history\n\nWhat would you like to review today?`,
        source: 'supabase'
      };
    }

    // STAFF
    return {
      message: `Assalam-o-Alaikum ${humanName}! 👋 I am your **Shopping Mall Management Assistant**.\n\nI can help you:\n• Check which item sold the most (*"Which item sold the most this week?"*)\n• Check current product availability and retail prices\n• Record incoming shipments (**Stock In**)\n• Record outbound dispatches (**Stock Out**)\n• Review items that need reordering\n\nJust tell me what item you'd like to check or move!`,
      source: 'supabase'
    };
  }

  // ==============================================================================
  // 12. DEFAULT DETERMINISTIC FALLBACK
  // ==============================================================================
  const isHelpQuery = /(?:^|\b)(?:help|commands?|options?|what\s+can\s+you\s+do|menu|instructions)\b/i.test(cleanQuery);
  if (!isHelpQuery) {
    try {
      const allProducts = await getProducts(effectiveRole);
      const matched = findBestMatchingProduct(cleanQuery, allProducts);

      if (matched) {
        const isLow = matched.quantity_on_hand <= matched.reorder_level;
        const financialSnippet = (effectiveRole !== 'STAFF' && matched.cost_price !== undefined)
          ? `\n• **Wholesale Cost**: PKR ${matched.cost_price.toLocaleString()} | **Margin**: ${matched.profit_margin_percent}%`
          : '';

        return {
          message: `📦 **Stock Availability: ${matched.name}**\n\n• **SKU**: \`${matched.sku}\`\n• **Quantity on Hand**: **${matched.quantity_on_hand}** units\n• **Status**: ${isLow ? '⚠️ **Low Stock** (Reorder threshold: ' + matched.reorder_level + ')' : '✅ Well Stocked'}\n• **Category**: ${matched.category_name || 'General'}\n• **Retail Price**: PKR ${matched.selling_price.toLocaleString()}${financialSnippet}`,
          source: 'supabase',
          productCard: matched
        };
      }

      // If user typed a short query (<= 8 words) that was not found in catalog:
      const words = cleanQuery.split(/\s+/).filter(Boolean);
      if (words.length <= 8) {
        const itemAttempt = extractQueriedItemName(cleanQuery) || cleanQuery.replace(/[?!.]+$/, '').trim();
        const availableNames = allProducts.map((p) => `• **${p.name}** (\`${p.sku}\`)`).join('\n');

        return {
          message: `This item is not available in the list.\n\n**${itemAttempt}** is currently not listed in the store inventory catalog for Nowshera Shopping Mall.\n\n📦 **Currently available products:**\n${availableNames}\n\nYou can ask about any of the items above, or an Administrator can add new products in the **Products** section.`,
          source: 'supabase'
        };
      }
    } catch (e) {
      // Fall through to default help
    }
  }

  const roleHelp = effectiveRole !== 'STAFF'
    ? `• **Top Seller**: *"Which item sold the most this week?"*\n• **Financial Margins**: *"What is the cost price and profit of [Product]?"*\n• **Audit Trail**: *"Show recent stock movements"*`
    : `• **Top Seller**: *"Which item sold the most this week?"*\n• **Check Stock**: *"Do we have [Product]?"*\n• **Low Stock**: *"What products need reordering?"*`;

  return {
    message: `I am here to assist with store inventory management for Nowshera Shopping Mall.\n\nHere are some operations you can request:\n• **Top Seller**: *"Which item sold the most this week?"*\n• **Stock In**: *"Stock in 20 [Product Name]"*\n• **Stock Out**: *"Stock out 5 [Product Name]"*\n${roleHelp}`,
    source: 'supabase'
  };
}

/**
 * Direct confirmation of pending stock change request
 */
export async function confirmStockChangeViaSupabase(
  requestId: string,
  user?: { id: string; name: string; role: UserRole }
): Promise<boolean> {
  if (!requestId) {
    throw new Error('No pending request_id to confirm.');
  }

  const confirmKey = `ai-confirm-${requestId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  await confirmStockChangeRequest(requestId, confirmKey, user ? { id: user.id, name: user.name } : undefined);
  setPendingRequestId(null);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('stocksense:inventory_updated'));
  }

  return true;
}

/**
 * Direct cancellation of pending stock change request
 */
export async function cancelStockChangeViaSupabase(
  requestId: string,
  user?: { id: string; name: string; role: UserRole }
): Promise<boolean> {
  if (!requestId) return true;

  await cancelStockChangeRequest(requestId);
  setPendingRequestId(null);

  return true;
}

// Backwards-compatible aliases for existing component imports
export const confirmStockChangeViaN8n = confirmStockChangeViaSupabase;
export const cancelStockChangeViaN8n = cancelStockChangeViaSupabase;
