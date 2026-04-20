import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
  id: number;
  role: 'user' | 'alex';
  text: string;
};

const SCRIPT: Omit<Message, 'id'>[] = [
  { role: 'user', text: 'Where do I get my W-2?' },
  {
    role: 'alex',
    text: 'Log into your payroll portal — ADP at adp.com, Workday at workday.com, or Paychex. Go to Pay & Tax → Tax Documents and download both years.',
  },
  { role: 'user', text: 'I use ADP' },
  {
    role: 'alex',
    text: 'Go to adp.com → Sign In → Pay & Tax → Tax Statements. Download 2023 and 2024 and upload them here. Takes about 2 minutes ✓',
  },
];

const TYPING_DELAY = 1100; // how long the "..." dots show before an Alex reply
const USER_DELAY = 700; // pause before the user's next message
const READ_DELAY = 2200; // how long users read Alex's reply before next user message
const RESET_DELAY = 3500; // pause at end before restart

export default function AlexChatDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const wait = (ms: number) =>
      new Promise<void>(resolve => {
        const t = setTimeout(() => resolve(), ms);
        timeouts.push(t);
      });

    const run = async () => {
      while (!cancelled) {
        setMessages([]);
        setTyping(false);
        await wait(600);

        for (let i = 0; i < SCRIPT.length; i++) {
          if (cancelled) return;
          const msg = SCRIPT[i];

          if (msg.role === 'alex') {
            setTyping(true);
            await wait(TYPING_DELAY);
            if (cancelled) return;
            setTyping(false);
            idRef.current += 1;
            setMessages(prev => [...prev, { ...msg, id: idRef.current }]);
            await wait(READ_DELAY);
          } else {
            await wait(USER_DELAY);
            if (cancelled) return;
            idRef.current += 1;
            setMessages(prev => [...prev, { ...msg, id: idRef.current }]);
          }
        }

        await wait(RESET_DELAY);
      }
    };

    run();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Auto-scroll to bottom as new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: '#111f2e', border: '0.5px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          A
        </div>
        <div className="flex-1">
          <p className="font-body font-semibold text-foreground text-sm">Alex</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Document Assistant
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mt-4 space-y-3 h-[280px] overflow-hidden flex flex-col"
      >
        <AnimatePresence initial={false}>
          {messages.map(m => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[80%] bg-primary/15 text-foreground rounded-2xl px-4 py-2.5 text-sm font-body'
                  : 'mr-auto max-w-[80%] bg-secondary text-foreground rounded-2xl px-4 py-2.5 text-sm font-body'
              }
            >
              {m.text}
            </motion.div>
          ))}

          {typing && (
            <motion.div
              key="typing"
              layout
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="mr-auto bg-secondary rounded-2xl px-4 py-3 flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
