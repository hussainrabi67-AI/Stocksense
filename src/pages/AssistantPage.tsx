import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Database,
  RefreshCw,
  User,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendAIMessage, resetConversationId, setPendingRequestId, getPendingRequestId, getHumanName } from '../lib/ai';
import { ChatMessage, Product } from '../types/inventory';
import { AIStockConfirmationCard } from '../components/ai/AIStockConfirmationCard';
import { Badge } from '../components/common/Badge';
import { getSupabaseCredentials } from '../lib/supabase';
import { getProducts } from '../lib/api';

interface AssistantPageProps {
  onRefreshInventory?: () => void;
}

export const AssistantPage: React.FC<AssistantPageProps> = ({ onRefreshInventory }) => {
  const { user, role } = useAuth();
  const humanName = getHumanName(user?.full_name, user?.email);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    let welcome = `Assalam-o-Alaikum ${humanName}! 👋 I am your **Shopping Mall Management Assistant**.\n\nI can help you check product availability and retail prices, or record incoming shipments (**Stock In**) and stock deductions (**Stock Out**). How can I assist you today?`;
    if (role === 'ADMIN') {
      welcome = `Assalam-o-Alaikum ${humanName}! 👋 I am your **Shopping Mall Management Assistant**.\n\nAs an **Administrator**, you have full access to record Stock In/Out, inspect wholesale cost prices and profit margins, review the movement audit log, or check total store inventory valuation. How can I assist you today?`;
    } else if (role === 'MANAGER') {
      welcome = `Assalam-o-Alaikum ${humanName}! 👋 I am your **Shopping Mall Management Assistant**.\n\nAs a **Store Manager**, you can record stock movements, inspect profit margins and reorder alerts, and review today's movement history. What would you like to review?`;
    }

    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: welcome,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const creds = getSupabaseCredentials();

  const activeRequestIdRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string, explicitRequestId?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    // Detect if there is an active pending confirmation request in messages state or storage
    const pendingReqFromState = [...messages].reverse().find(
      (m) => m.confirmationRequest && m.confirmationRequest.status === 'PENDING'
    )?.confirmationRequest;

    const activeReqId = explicitRequestId || pendingReqFromState?.id || getPendingRequestId() || undefined;

    const reqId = Date.now();
    activeRequestIdRef.current = reqId;

    const userMsg: ChatMessage = {
      id: 'msg-' + reqId,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await sendAIMessage(
        textToSend.trim(),
        {
          id: user?.id || 'demo-user',
          name: user?.full_name || 'Staff Member',
          role
        },
        undefined,
        activeReqId
      );

      // Prevent stale responses from earlier questions
      if (activeRequestIdRef.current !== reqId) return;

      // Store the real pending stock-change request ID
      if (
        response.confirmationRequest?.status === 'PENDING' &&
        response.confirmationRequest?.id
      ) {
        setPendingRequestId(response.confirmationRequest.id);
      }

      const aiMsg: ChatMessage = {
        id: 'msg-ai-' + Date.now(),
        role: 'assistant',
        content: response.message,
        source: response.source,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confirmationRequest: response.confirmationRequest,
        productCard: response.productCard,
        error: response.error
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      if (activeRequestIdRef.current !== reqId) return;
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: 'The assistant is temporarily unavailable. All inventory data remains secure, and you can continue managing stock directly from the main store tabs.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      if (activeRequestIdRef.current === reqId) {
        setIsLoading(false);
      }
    }
  };

  const clearChat = () => {
    activeRequestIdRef.current = Date.now();
    setPendingRequestId(null);
    resetConversationId(user?.id);
    setMessages([
      {
        id: 'msg-welcome-new',
        role: 'assistant',
        content: `Conversation reset. Ready for your next store inventory command or lookup.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const [realProducts, setRealProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const prods = await getProducts(role);
        setRealProducts(prods);
      } catch (e) {
        // ignore
      }
    }
    fetchCatalog();
  }, [role]);

  const p1 = realProducts[0]?.name || 'Fast Charging Cable';
  const SUGGESTED_QUERIES = role !== 'STAFF'
    ? [
        'Which item sold the most this week?',
        `What is the cost price and margin of ${p1}?`,
        `Stock in 25 ${p1}`,
        'Show recent stock movements',
        'What products are low in stock?'
      ]
    : [
        'Which item sold the most this week?',
        `Check stock of ${p1}`,
        `Stock in 20 ${p1}`,
        `Stock out 5 ${p1}`,
        'What products are low in stock?'
      ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Copilot Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Mall Management Assistant</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {role === 'ADMIN' ? 'Administrator' : role === 'MANAGER' ? 'Store Manager' : 'Staff Access'}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span>Nowshera Shopping Mall</span>
              <span>•</span>
              <span className="text-emerald-600 font-medium">Real-Time Store Inventory</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                  isUser
                    ? 'bg-slate-900 text-white'
                    : msg.error
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-teal-600 text-white'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-xl rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : msg.error
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-none'
                    : 'bg-slate-100 text-slate-900 rounded-tl-none'
                }`}
              >
                {/* Content formatting */}
                <div className="whitespace-pre-line">
                  {msg.content.split('\n').map((line, lIdx) => {
                    // Simple bold formatting
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <p key={lIdx} className="my-1">
                        {parts.map((part, pIdx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={pIdx} className="font-bold">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        })}
                      </p>
                    );
                  })}
                </div>

                {/* 2-Step Stock Change Request Confirmation Card */}
                {msg.confirmationRequest && (
                  <AIStockConfirmationCard
                    request={msg.confirmationRequest}
                    user={{
                      id: user?.id || 'user',
                      name: user?.full_name || 'Staff Member',
                      role
                    }}
                    onConfirm={async (reqId) => {
                      // Return that id with confirmed msg to update that stock
                      await handleSend("Confirmed", reqId);
                    }}
                    onCancel={async (reqId) => {
                      await handleSend("Cancel", reqId);
                    }}
                    onSuccess={async () => {
                      try {
                        const prods = await getProducts(role);
                        setRealProducts(prods);
                      } catch (e) {}
                      if (onRefreshInventory) onRefreshInventory();
                    }}
                    onCancelled={() => {
                      setPendingRequestId(null);
                    }}
                  />
                )}

                {/* Timestamp */}
                <div
                  className={`mt-1.5 text-[10px] font-mono flex items-center gap-2 ${
                    isUser ? 'text-slate-400 justify-end' : 'text-slate-500 justify-between'
                  }`}
                >
                  {!isUser && msg.source === 'n8n' && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md">
                      ⚡ n8n Workflow
                    </span>
                  )}
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse delay-75" />
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse delay-150" />
              <span className="text-xs text-slate-500 font-medium ml-1">
                Consulting Mall Database...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Pills */}
      <div className="px-6 py-2 bg-slate-50/70 border-t border-slate-100 overflow-x-auto flex items-center gap-1.5 shrink-0 scrollbar-none">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-1" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          Try:
        </span>
        {SUGGESTED_QUERIES.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSend(q)}
            disabled={isLoading}
            className="text-[11px] whitespace-nowrap bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 px-2.5 py-1 rounded-full text-slate-600 transition-colors shrink-0 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 border-t border-slate-200 bg-white flex items-center gap-3 shrink-0"
      >
        <input
          type="text"
          placeholder="Ask about inventory, or enter stock commands (e.g. 'Add 40 Type-C cables from Ali Traders')..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 placeholder-slate-400"
        />

        <button
          type="submit"
          disabled={isLoading || !inputQuery.trim()}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
