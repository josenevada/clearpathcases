import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircleQuestion, Send, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DocumentHelpChatProps {
  documentLabel: string;
  category: string;
  chapterType: string;
}

const DocumentHelpChat = ({ documentLabel, category, chapterType }: DocumentHelpChatProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset chat when document changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setLoading(false);
  }, [documentLabel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('document-agent-help', {
        body: {
          document_category: documentLabel,
          chapter_type: chapterType,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;

      const aiResponse = data?.response || "I'm having trouble right now. Please try again.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble right now. Please follow the written steps above or contact your attorney's office." }]);
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

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mx-auto"
      >
        <MessageCircleQuestion className="w-4 h-4" />
        Have a question? Ask for help
      </button>

      {/* Bottom sheet overlay */}
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
              style={{ maxHeight: '70vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar + header */}
              <div className="px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Document Help</h3>
                    <p className="text-xs text-muted-foreground">{documentLabel}</p>
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
                {messages.length === 0 && !loading && (
                  <div className="text-center py-6">
                    <MessageCircleQuestion className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Ask me anything about finding your {documentLabel.toLowerCase()}.
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {[
                        'Where do I find this?',
                        'What does this look like?',
                        'Can I use a screenshot?',
                      ].map(q => (
                        <button
                          key={q}
                          onClick={() => {
                            const userMsg: ChatMessage = { role: 'user', content: q };
                            setMessages(prev => [...prev, userMsg]);
                            setLoading(true);
                            supabase.functions.invoke('document-agent-help', {
                              body: {
                                document_category: documentLabel,
                                chapter_type: chapterType,
                                messages: [{ role: 'user', content: q }],
                              },
                            }).then(({ data, error }) => {
                              const aiResponse = error ? "I'm having trouble right now." : (data?.response || "I'm having trouble right now.");
                              setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
                            }).catch(() => {
                              setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble right now." }]);
                            }).finally(() => setLoading(false));
                          }}
                          className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:mt-1 [&_ol]:mt-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
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
                    placeholder="Type your question…"
                    className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                    disabled={loading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 transition-opacity hover:bg-primary/90"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DocumentHelpChat;
