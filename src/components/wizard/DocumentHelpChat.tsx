import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Loader2, ExternalLink, Sparkles, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
  animate?: boolean; // typewriter on first render
  // Agent UI extensions (only used when kind is set)
  kind?: 'text' | 'provider-picker' | 'agent-status' | 'agent-auth' | 'agent-success' | 'agent-failed';
  payload?: any;
}

const TYPE_CHAR_MS = 14;

const W2_LABEL = 'W-2s (Last 2 Years)';
const PAYSTUB_LABEL = 'Pay Stubs (Last 2 Months)';

type ProviderId = 'adp' | 'workday' | 'paychex' | 'gusto' | 'paylocity';
type DocType = 'w2' | 'paystub';

const PROVIDERS: Array<{ id: ProviderId; name: string }> = [
  { id: 'adp', name: 'ADP' },
  { id: 'workday', name: 'Workday' },
  { id: 'paychex', name: 'Paychex' },
  { id: 'gusto', name: 'Gusto' },
  { id: 'paylocity', name: 'Paylocity' },
];

const STATUS_MESSAGES: Record<ProviderId, string[]> = {
  adp: ['Opening ADP portal…', 'Navigating to your documents…', 'Looking for your W-2s…'],
  workday: ['Opening Workday…', 'Navigating to pay & tax documents…', 'Looking for your W-2s…'],
  paychex: ['Opening Paychex Flex…', 'Navigating to tax documents…', 'Looking for your W-2s…'],
  gusto: ['Opening Gusto…', 'Navigating to documents…', 'Looking for your W-2s…'],
  paylocity: ['Opening Paylocity…', 'Navigating to tax documents…', 'Looking for your W-2s…'],
};

const DEEP_LINKS: Record<ProviderId, { label: string; url: string; instruction: string }> = {
  adp: { label: 'Open ADP Portal', url: 'https://my.adp.com', instruction: 'Log in → Pay & Tax → W-2' },
  workday: { label: 'Open Workday', url: 'https://www.myworkday.com', instruction: 'Click your name → Pay → Tax Documents' },
  paychex: { label: 'Open Paychex Flex', url: 'https://myapps.paychex.com', instruction: 'Pay → Tax Documents → W-2' },
  gusto: { label: 'Open Gusto', url: 'https://app.gusto.com', instruction: 'Documents → Tax Documents → W-2' },
  paylocity: { label: 'Open Paylocity', url: 'https://access.paylocity.com', instruction: 'Pay → Tax Documents → W-2' },
};

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

const AuthIframe = ({ browserSessionUrl, providerName }: { browserSessionUrl: string; providerName: string }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-[520px]">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          <p className="text-xs text-muted-foreground">Loading {providerName} portal…</p>
        </div>
      )}
      <iframe
        src={browserSessionUrl}
        title={`${providerName} login`}
        className="w-full h-full bg-background border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        allow="clipboard-read; clipboard-write"
        onLoad={() => setLoaded(true)}
      />
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

  // Agent flow refs (kept out of render state where possible)
  const agentActiveRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isW2Step = documentLabel === W2_LABEL;

  // Reset chat when document changes, seed with Alex intro
  useEffect(() => {
    setMessages([{ role: 'assistant', content: ALEX_INTRO }]);
    setInput('');
    setLoading(false);
    cleanupAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentLabel, language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    return () => cleanupAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupAgent = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    pollIntervalRef.current = null;
    timeoutRef.current = null;
    statusIntervalRef.current = null;
    agentActiveRef.current = false;
  };

  const replaceLastAgentMessage = (updater: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].kind && prev[i].kind !== 'text') {
          const next = [...prev];
          next[i] = updater(prev[i]);
          return next;
        }
      }
      return prev;
    });
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
        .filter((m) => !m.kind || m.kind === 'text')
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
      .filter((m) => !m.kind || m.kind === 'text')
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

  // ─────────────────────────────────────────────
  // W-2 agent flow
  // ─────────────────────────────────────────────

  const startAgentRetrievalIntro = () => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: 'Get my W-2 automatically ✨' },
      {
        role: 'assistant',
        animate: true,
        content:
          "I can retrieve your W-2 directly from your payroll portal — no downloading or scanning needed. Which payroll provider does your employer use?",
      },
      {
        role: 'assistant',
        kind: 'provider-picker',
        content: '',
      },
    ]);
  };

  const handleProviderPick = async (provider: ProviderId) => {
    if (!caseId || !checklistItemId) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I can't start the agent right now — please refresh and try again.", animate: true },
      ]);
      return;
    }

    cleanupAgent();
    agentActiveRef.current = true;

    // Mark provider picker as resolved by appending the user choice
    setMessages((prev) => {
      const next = prev.filter((m) => m.kind !== 'provider-picker');
      return [
        ...next,
        { role: 'user', content: PROVIDERS.find((p) => p.id === provider)?.name ?? provider },
        {
          role: 'assistant',
          kind: 'agent-status',
          content: '',
          payload: { provider, statusIdx: 0 },
        },
      ];
    });

    // Stream status messages in the same bubble
    let idx = 0;
    statusIntervalRef.current = setInterval(() => {
      if (!agentActiveRef.current) return;
      idx += 1;
      if (idx >= STATUS_MESSAGES[provider].length) {
        if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
        return;
      }
      replaceLastAgentMessage((m) => ({ ...m, payload: { ...(m.payload || {}), statusIdx: idx } }));
    }, 1500);

    // Kick off browser session creation in parallel
    let sessionId = '';
    let browserSessionUrl: string | undefined;
    let providerUrl: string | undefined;
    try {
      const { data, error } = await supabase.functions.invoke('create-browser-session', {
        body: { provider, caseId },
      });
      if (error) throw error;
      sessionId = data?.sessionId;
      browserSessionUrl = data?.browserSessionUrl;
      providerUrl = data?.providerUrl;
      if (!sessionId) throw new Error('No session id returned');
    } catch (err) {
      console.error('create-browser-session failed', err);
      cleanupAgent();
      showAgentFailure(provider, 'Could not open the payroll portal.');
      return;
    }

    // Show auth iframe
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = null;

    const providerName = PROVIDERS.find((p) => p.id === provider)?.name ?? provider;
    replaceLastAgentMessage(() => ({
      role: 'assistant',
      kind: 'agent-auth',
      content: '',
      payload: { provider, providerName, browserSessionUrl, providerUrl, sessionId },
    }));

    // Poll for auth completion
    pollIntervalRef.current = setInterval(async () => {
      if (!agentActiveRef.current) return;
      try {
        const { data } = await supabase.functions.invoke('check-session-auth', {
          body: { sessionId, provider },
        });
        if (data?.authenticated) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;

          // Switch back to streaming status messages while retrieving
          replaceLastAgentMessage(() => ({
            role: 'assistant',
            kind: 'agent-status',
            content: '',
            payload: { provider, statusIdx: 1, retrieving: true },
          }));

          let rIdx = 1;
          statusIntervalRef.current = setInterval(() => {
            rIdx += 1;
            if (rIdx >= STATUS_MESSAGES[provider].length) {
              if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
              statusIntervalRef.current = null;
              return;
            }
            replaceLastAgentMessage((m) => ({ ...m, payload: { ...(m.payload || {}), statusIdx: rIdx } }));
          }, 1500);

          try {
            const { data: rData, error: rError } = await supabase.functions.invoke('retrieve-w2', {
              body: { sessionId, provider, caseId, checklistItemId },
            });
            if (rError) throw rError;

            cleanupAgent();
            if (rData?.success && Array.isArray(rData.files) && rData.files.length > 0) {
              showAgentSuccess(provider, rData.files);
              onAgentFilesAdded?.();
            } else {
              showAgentFailure(provider);
            }
          } catch (err) {
            console.error('retrieve-w2 failed', err);
            cleanupAgent();
            showAgentFailure(provider);
          }
        }
      } catch (err) {
        console.error('check-session-auth failed', err);
      }
    }, 5000);

    // Hard timeout 5 minutes
    timeoutRef.current = setTimeout(() => {
      if (!agentActiveRef.current) return;
      cleanupAgent();
      showAgentFailure(provider, 'Timed out waiting for sign-in.');
    }, 300000);
  };

  const showAgentSuccess = (
    provider: ProviderId,
    files: Array<{ fileName: string; year: string; employerName?: string }>,
  ) => {
    const yearList = files.map((f) => f.year).join(' and ');
    const employer = files.find((f) => f.employerName)?.employerName;
    const employerSuffix = employer ? ` from ${employer}` : '';
    const msg = `Got it! I found your W-2 for ${yearList}${employerSuffix}. It's been added to your documents.`;
    replaceLastAgentMessage(() => ({
      role: 'assistant',
      kind: 'agent-success',
      content: msg,
      payload: { provider, files },
      animate: true,
    }));
  };

  const showAgentFailure = (provider: ProviderId, reason?: string) => {
    const intro = reason ? `${reason} ` : '';
    const msg = `${intro}No worries — sometimes these portals are tricky. Here's a direct link to download your W-2 from ${PROVIDERS.find((p) => p.id === provider)?.name ?? provider} yourself:`;
    replaceLastAgentMessage(() => ({
      role: 'assistant',
      kind: 'agent-failed',
      content: msg,
      payload: { provider },
      animate: true,
    }));
  };

  // Render helpers for agent-specific messages
  const renderAgentMessage = (msg: ChatMessage) => {
    if (msg.kind === 'provider-picker') {
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProviderPick(p.id)}
                className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (msg.kind === 'agent-status') {
      const provider: ProviderId = msg.payload?.provider;
      const idx: number = msg.payload?.statusIdx ?? 0;
      const text = STATUS_MESSAGES[provider]?.[idx] ?? 'Working…';
      return (
        <div className="flex items-center gap-2.5">
          <motion.span
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-sm text-foreground">{text}</span>
        </div>
      );
    }

    if (msg.kind === 'agent-auth') {
      const { providerName, browserSessionUrl, providerUrl } = msg.payload || {};
      return (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">Secure connection to {providerName}</span>
          </div>
          {browserSessionUrl ? (
            <AuthIframe browserSessionUrl={browserSessionUrl} providerUrl={providerUrl} providerName={providerName} />
          ) : (
            <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
              Connecting…
            </div>
          )}
          <p className="text-xs text-muted-foreground px-4 py-2 text-center">ClearPath never sees your password</p>
        </div>
      );
    }

    if (msg.kind === 'agent-failed') {
      const provider: ProviderId = msg.payload?.provider;
      const link = DEEP_LINKS[provider];
      return (
        <div className="space-y-2">
          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
          {link && (
            <div className="space-y-1.5 pt-1">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {link.label}
              </a>
              <p className="text-xs text-muted-foreground">{link.instruction}</p>
            </div>
          )}
        </div>
      );
    }

    return null;
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
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-background rounded-t-2xl flex flex-col"
            style={{ maxHeight: '85vh' }}
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
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
              {messages.map((msg, i) => {
                const isAgentKind = msg.kind && msg.kind !== 'text';
                return (
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
                      } ${isAgentKind ? 'w-[85%]' : ''}`}
                    >
                      {msg.role === 'assistant' ? (
                        isAgentKind ? (
                          renderAgentMessage(msg)
                        ) : msg.animate ? (
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
                );
              })}

              {/* Quick suggestions after intro message */}
              {messages.length === 1 && messages[0].content === ALEX_INTRO && !loading && (
                <div className="flex flex-wrap gap-2 pl-8">
                  {isW2Step && caseId && checklistItemId && (
                    <button
                      onClick={startAgentRetrievalIntro}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      Get my W-2 automatically
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
