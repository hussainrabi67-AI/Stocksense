import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Trash2,
  ExternalLink,
  ChevronDown,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sendAIMessage, resetConversationId, setPendingRequestId, getPendingRequestId } from '../../lib/ai';
import { ChatMessage } from '../../types/inventory';
import { AIStockConfirmationCard } from './AIStockConfirmationCard';
import { Badge } from '../common/Badge';

interface AICopilotPopupProps {
  onNavigate?: (path: string) => void;
  onRefreshInventory?: () => void;
}

export const AICopilotPopup: React.FC<AICopilotPopupProps> = ({
  onNavigate,
  onRefreshInventory
}) => {
  const { user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'popup-welcome',
      role: 'assistant',
      content: `Hi **${user?.full_name?.split(' ')[0] || 'there'}**! 👋 I am your **StockSense Copilot**.\n\nAsk me about stock quantities, low-stock warnings, today's shipments, or reorders anytime without leaving your current screen.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen, isMinimized]);

  const activeRequestIdRef = useRef<number>(0);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setHasUnread(false);
  };

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
      id: 'popup-msg-' + reqId,
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
          id: user?.id || 'popup-user',
          name: user?.full_name || 'Mall Staff',
          role
        },
        undefined,
        activeReqId
      );

      // Prevent stale responses from earlier questions
      if (activeRequestIdRef.current !== reqId) return;

      const aiMsg: ChatMessage = {
        id: 'popup-ai-' + Date.now(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confirmationRequest: response.confirmationRequest,
        productCard: response.productCard,
        error: response.error
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      if (activeRequestIdRef.current !== reqId) return;
      const errorMsg: ChatMessage = {
        id: 'popup-err-' + Date.now(),
        role: 'assistant',
        content: 'AI Assistant is temporarily unavailable.',
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
        id: 'popup-reset-' + Date.now(),
        role: 'assistant',
        content: `Chat history cleared. How can I assist you with Nowshera Mall inventory?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const quickPrompts = [
    { label: 'Low Stock Alert', text: 'Which items are low in stock right now?' },
    { label: 'Stock In Summary', text: "How much inventory came in today?" },
    { label: 'Inventory Count', text: 'What is the total quantity of inventory on hand?' },
    ...(role !== 'STAFF' ? [{ label: 'Valuation', text: 'What is our total retail inventory value?' }] : [])
  ];

  return (
    <>
      {/* Floating Trigger Button (Always available in bottom right corner) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 group">
          <button
            onClick={handleOpen}
            className="relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-full shadow-lg hover:shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all duration-300 border border-emerald-400/30 cursor-pointer"
            aria-label="Open AI Copilot"
          >
            <div className="relative">
              <Bot className="w-5 h-5 transition-transform group-hover:rotate-12 duration-300" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-300"></span>
              </span>
            </div>
            <span className="text-xs tracking-wide font-extrabold pr-0.5">AI Copilot</span>

            {hasUnread && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-950/60 text-emerald-200 rounded-full border border-emerald-400/20">
                Live
              </span>
            )}
          </button>
        </div>
      )}

      {/* Pop-up Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-4 sm:right-6 z-50 w-[94vw] sm:w-[430px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300 transform ${
            isMinimized ? 'h-14' : 'h-[560px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between text-white shrink-0 border-b border-slate-700/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xs shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-white truncate">StockSense Copilot</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">Nowshera Mall Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={clearChat}
                title="Clear conversation"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {onNavigate && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('/assistant');
                  }}
                  title="Expand to Full Assistant Page"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body when not minimized */}
          {!isMinimized && (
            <>
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 text-xs">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 shadow-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-xs'
                          : msg.error
                          ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-xs'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans text-xs">
                        {msg.content}
                      </div>

                      {/* Confirmation request card for draft stock mutations */}
                      {msg.confirmationRequest && (
                        <div className="mt-2.5">
                          <AIStockConfirmationCard
                            request={msg.confirmationRequest}
                            user={{
                              id: user?.id || 'popup-user',
                              name: user?.full_name || 'Mall Staff',
                              role
                            }}
                            onConfirm={async (reqId) => {
                              // Return that id with confirmed msg to update that stock
                              await handleSend("Confirmed", reqId);
                            }}
                            onSuccess={() => {
                              onRefreshInventory?.();
                            }}
                            onCancelled={() => {
                              setPendingRequestId(null);
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-xs max-w-[70%] text-slate-500 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                    <span className="text-xs font-medium text-slate-600">Copilot thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick suggestion chips */}
              <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p.text)}
                    disabled={isLoading}
                    className="shrink-0 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 px-2.5 py-1 rounded-full border border-slate-200 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask inventory query or draft reorder..."
                  className="flex-1 bg-slate-100 hover:bg-slate-50 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isLoading}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};
