import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

type ChatRole = 'user' | 'assistant';
type AgentStatus =
  | 'idle'
  | 'choose_provider'
  | 'starting'
  | 'waiting_for_login'
  | 'running'
  | 'success'
  | 'failed';

interface ChatMessage {
  role: ChatRole;
  content: string;
  animate?: boolean;
}

const TYPE_CHAR_MS = 14;

const TypewriterMarkdown = ({
  text,
  onTick,
  onDone,
}: {
  text: string;
  onTick?: () => void;
  onDone?: () => void;
}) => {
  const [shown, setShown] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setShown(0);
    const iv = setInterval(() => {
      if (cancelledRef.current) {
        clearInterval(iv);
        return;
      }
      setShown((s) => {
        const next = s + 1;
        if (next >= text.length) {
          clearInterval(iv);
          onDone?.();
          return text.length;
        }
        onTick?.();
        return next;
      });
    }, TYPE_CHAR_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const isDone = shown >= text.length;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:mt-1 [&_ol]:mt-1">
      <ReactMarkdown>{text.slice(0, shown)}</ReactMarkdown>
      {!isDone && (
        <motion.span
          className="inline-block w-[2px] h-[1em] bg-foreground/70 ml-0.5 align-middle"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
};

interface DocumentHelpChatProps {
  documentLabel: string;
  category: string;
  chapterType: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  language?: 'en' | 'es';
  caseId?: string;
  checklistItemId?: string;
  onAgentFilesAdded?: () => void;
}

const ALEX_INTRO_EN = "Hey — what can I help you find? I can tell you where to get this document, what it should look like, or anything else you're stuck on.";
const ALEX_INTRO_ES = "Hola — ¿qué puedo ayudarte a encontrar? Puedo decirte dónde conseguir este documento, cómo debería verse, o cualquier otra cosa con la que estés atorado.";

const PROVIDERS = ['ADP', 'Workday', 'Paychex', 'Gusto', 'Paylocity'];
const PROVIDER_URLS: Record<string, string> = {
  adp: 'https://my.adp.com',
  workday: 'https://www.myworkday.com',
  paychex: 'https://myapps.paychex.com',
  gusto: 'https://app.gusto.com',
  paylocity: 'https://access.paylocity.com',
};


const DocumentHelpChat = ({
  documentLabel,
  category,
  chapterType,
  isOpen,
  onOpenChange,
  language = 'en',
  caseId,
  checklistItemId,
  onAgentFilesAdded,
}: DocumentHelpChatProps) => {
  const ALEX_INTRO = language === 'es' ? ALEX_INTRO_ES : ALEX_INTRO_EN;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const agentStatusRef = useRef<AgentStatus>('idle');

  useEffect(() => {
    agentStatusRef.current = agentStatus;
  }, [agentStatus]);

  const isW2 = documentLabel === 'W-2s (Last 2 Years)';
  const isPaystubs = documentLabel === 'Pay Stubs (Last 2 Months)';
  const agentSupported = isW2 || isPaystubs;

  useEffect(() => {
    setMessages([{ role: 'assistant', content: ALEX_INTRO }]);
    setInput('');
    setLoading(false);
    setAgentStatus('idle');
    setLiveUrl(null);
    setSelectedProvider(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentLabel, language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, agentStatus, liveUrl]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Cleanup: stop Browser Use task on unmount
  useEffect(() => {
    return () => {
      if (taskId) {
        supabase.functions
          .invoke('check-agent-status', { body: { taskId, action: 'stop' } })
          .catch(() => {});
      }
    };
  }, [taskId]);

  const handleClose = () => {
    if (taskId) {
      supabase.functions
        .invoke('check-agent-status', { body: { taskId, action: 'stop' } })
        .catch(() => {});
    }
    setTaskId(null);
    setLiveUrl(null);
    setAgentStatus('idle');
    setSelectedProvider(null);
    setOpen(false);
  };

  const handleAgentRetrieval = async (provider: string) => {
    setSelectedProvider(provider);
    setAgentStatus('starting');

    const documentType = isW2 ? 'w2' : 'paystubs';

    try {
      const startRes = await supabase.functions.invoke('start-agent-retrieval', {
        body: { provider, documentType },
      });
      if (startRes.error) throw startRes.error;

      const { taskId: newTaskId, liveUrl: newLiveUrl } = startRes.data || {};
      if (!newTaskId) throw new Error('No task id returned');

      setTaskId(newTaskId);
      setLiveUrl(newLiveUrl);
      setAgentStatus('waiting_for_login');

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await supabase.functions.invoke('check-agent-status', {
            body: { taskId: newTaskId, action: 'status' },
          });

          const { status, liveUrl: updatedLiveUrl } = statusRes.data || {};
          if (updatedLiveUrl && agentStatusRef.current === 'waiting_for_login') {
            setLiveUrl(updatedLiveUrl);
          }

          // While the user is still completing login, ignore session
          // status changes — the user controls the transition via the
          // "I've logged in" button which dispatches the follow-up task.

          if (status === 'stopped') {
            clearInterval(pollInterval);
            setAgentStatus('running');
            setLiveUrl(null);

            const filesRes = await supabase.functions.invoke('get-agent-files', {
              body: { taskId: newTaskId, caseId, checklistItemId, documentType },
            });

            if (filesRes.data?.success) {
              setAgentStatus('success');
              onAgentFilesAdded?.();
            } else {
              setAgentStatus('failed');
            }
          }
        } catch (_) {}
      }, 4000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (agentStatusRef.current !== 'success' && agentStatusRef.current !== 'running') {
          setAgentStatus('failed');
          setLiveUrl(null);
          supabase.functions
            .invoke('check-agent-status', { body: { taskId: newTaskId, action: 'stop' } })
            .catch(() => {});
        }
      }, 300000);
    } catch (err) {
      console.error('Agent retrieval error:', err);
      setAgentStatus('failed');
    }
  };

  const handleLoginComplete = async () => {
    if (!taskId) return;
    setAgentStatus('running');
    setLiveUrl(null);
    const documentType = isW2 ? 'w2' : 'paystubs';
    try {
      await supabase.functions.invoke('check-agent-status', {
        body: { taskId, action: 'resume', documentType },
      });
    } catch (_) {}
  };


  const triggerAgentFlow = () => {
    const prompt = isW2
      ? 'Get my W-2 automatically ✨'
      : 'Get my pay stubs automatically ✨';
    const assistantReply = isW2
      ? "I can pull your W-2 directly from your payroll portal. Which provider does your employer use?"
      : "I can pull your pay stubs directly from your payroll portal. Which provider does your employer use?";
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: prompt },
      { role: 'assistant', content: assistantReply, animate: true },
    ]);
    setAgentStatus('choose_provider');
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = updatedMessages
        .filter((m, i) => !(i === 0 && m.role === 'assistant' && m.content === ALEX_INTRO))
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('document-agent-help', {
        body: {
          document_category: documentLabel,
          chapter_type: chapterType,
          messages: apiMessages,
          language,
        },
      });

      if (error) throw error;
      const aiResponse = data?.response || "I'm having trouble right now. Please try again.";
      setMessages((prev) => [...prev, { role: 'assistant', content: aiResponse, animate: true }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm having trouble right now. Please follow the written steps above or contact your attorney's office.", animate: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickQuestion = (q: string) => {
    const userMsg: ChatMessage = { role: 'user', content: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    const apiMessages = updatedMessages
      .filter((m, i) => !(i === 0 && m.role === 'assistant' && m.content === ALEX_INTRO))
      .map((m) => ({ role: m.role, content: m.content }));

    supabase.functions
      .invoke('document-agent-help', {
        body: { document_category: documentLabel, chapter_type: chapterType, messages: apiMessages, language },
      })
      .then(({ data, error }) => {
        const aiResponse = error ? "I'm having trouble right now." : data?.response || "I'm having trouble right now.";
        setMessages((prev) => [...prev, { role: 'assistant', content: aiResponse, animate: true }]);
      })
      .catch(() => {
        setMessages((prev) => [...prev, { role: 'assistant', content: "I'm having trouble right now.", animate: true }]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/40 flex items-end justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-background rounded-t-2xl flex flex-col"
            style={{ maxHeight: agentStatus === 'waiting_for_login' ? '95vh' : '85vh', height: agentStatus === 'waiting_for_login' ? '95vh' : undefined }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar + header */}
            <div className="px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/80 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground text-xs font-bold">A</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Alex</h3>
                    <p className="text-xs text-muted-foreground">{documentLabel}</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                      <span className="text-primary-foreground text-[10px] font-bold">A</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      msg.animate ? (
                        <TypewriterMarkdown
                          text={msg.content}
                          onTick={() => {
                            if (scrollRef.current) {
                              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                            }
                          }}
                          onDone={() => {
                            setMessages((prev) =>
                              prev.map((m, idx) => (idx === i ? { ...m, animate: false } : m)),
                            );
                          }}
                        />
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:mt-1 [&_ol]:mt-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {/* Quick suggestions after intro message */}
              {messages.length === 1 && messages[0].content === ALEX_INTRO && !loading && agentStatus === 'idle' && (
                <div className="flex flex-wrap gap-2 pl-8">
                  {agentSupported && (
                    <button
                      onClick={triggerAgentFlow}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
                    >
                      {isW2 ? 'Get my W-2 automatically ✨' : 'Get my pay stubs automatically ✨'}
                    </button>
                  )}
                  {(language === 'es'
                    ? ['¿Dónde encuentro esto?', '¿Cómo se ve?', '¿Puedo usar una captura de pantalla?']
                    : ['Where do I find this?', 'What does this look like?', 'Can I use a screenshot?']
                  ).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQuickQuestion(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Provider chooser */}
              {agentStatus === 'choose_provider' && (
                <div className="flex flex-wrap gap-2 pl-8">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handleAgentRetrieval(p.toLowerCase())}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Starting / running status */}
              {(agentStatus === 'starting' || agentStatus === 'running') && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 pl-8">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>
                    {agentStatus === 'starting'
                      ? 'Opening secure portal…'
                      : 'Retrieving your documents…'}
                  </span>
                </div>
              )}

              {/* Auth iframe — inline inside chat panel */}
              {liveUrl && agentStatus === 'waiting_for_login' && (
                <div className="rounded-xl border border-border overflow-hidden my-2 w-full">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      Secure connection to {selectedProvider?.toUpperCase()} — log in below
                    </span>
                  </div>
                  <iframe
                    src={liveUrl}
                    className="w-full border-0"
                    style={{ height: '520px' }}
                    title="Payroll portal login"
                    allow="clipboard-read; clipboard-write"
                  />
                  <p className="text-xs text-muted-foreground px-3 py-1.5 text-center border-t border-border">
                    ClearPath never sees your password
                  </p>
                  <div className="px-3 py-2 border-t border-border">
                    <button
                      onClick={handleLoginComplete}
                      className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      I've logged in — continue ✓
                    </button>
                  </div>
                </div>
              )}


              {/* Success */}
              {agentStatus === 'success' && (
                <p className="text-sm text-primary py-2 pl-8">
                  ✓ Documents retrieved and added to your file.
                </p>
              )}

              {/* Failure fallback */}
              {agentStatus === 'failed' && selectedProvider && (
                <div className="space-y-2 py-2 pl-8">
                  <p className="text-sm text-muted-foreground">
                    No worries — here's a direct link to download from {selectedProvider.toUpperCase()} yourself:
                  </p>
                  <a
                    href={PROVIDER_URLS[selectedProvider]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Open {selectedProvider.toUpperCase()} →
                  </a>
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <span className="text-primary-foreground text-[10px] font-bold">A</span>
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="px-4 py-3 border-t border-border flex-shrink-0 pb-safe">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={language === 'es' ? 'Pregúntale a Alex…' : 'Ask Alex anything…'}
                  className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 transition-opacity hover:bg-primary/90"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

    </AnimatePresence>

  );
};

export default DocumentHelpChat;
