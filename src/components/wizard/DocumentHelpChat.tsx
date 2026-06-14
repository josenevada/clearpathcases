import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content?: string;
  animate?: boolean;
  // Rich content variants
  kind?: 'text' | 'provider-picker' | 'provider-steps' | 'not-sure' | 'example' | 'tax-sources' | 'multi-bank';
  payload?: any;
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
  bankExtraUpload?: React.ReactNode;
  quantityInstruction?: string;
  proactiveMessage?: string | null;
  onProactiveMessageShown?: () => void;
}

const getStepIntro = (label: string, lang: 'en' | 'es'): string => {
  const l = label.toLowerCase();
  if (/pay stub/i.test(l)) return lang === 'es'
    ? 'Hola — estos vienen del portal de nómina de tu empleador. Si usas ADP, Workday o Paychex puedo llevarte directamente allí.'
    : "Hey — these come from your employer's payroll portal. If you use ADP, Workday, or Paychex I can take you straight there.";
  if (/w-?2/i.test(l)) return lang === 'es'
    ? 'Hola — tu W-2 viene del mismo lugar que tus talones de pago, solo en una sección diferente. Puedo ayudarte a encontrarlo.'
    : 'Hey — your W-2 comes from the same place as your pay stubs, just a different section. I can help you find it.';
  if (/tax return/i.test(l)) return lang === 'es'
    ? 'Hola — la mayoría de las personas presentaron con TurboTax o H&R Block. Puedo llevarte directamente a tu cuenta.'
    : 'Hey — most people filed with TurboTax or H&R Block. I can take you straight to your account.';
  if (/checking|savings|bank statement/i.test(l)) return lang === 'es'
    ? 'Hola — puedes conectar tu banco automáticamente — sin descargas ni escaneos. O sube los PDFs manualmente.'
    : 'Hey — you can connect your bank automatically — no downloading or scanning needed. Or upload PDFs manually.';
  if (/government.issued|driver|passport|\bid\b/i.test(l)) return lang === 'es'
    ? 'Hola — una foto clara con buena iluminación funciona bien. Coloca tu identificación plana y asegúrate de que las 4 esquinas sean visibles.'
    : 'Hey — a clear photo in good lighting works fine. Lay your ID flat and make sure all four corners are visible.';
  if (/social security/i.test(l)) return lang === 'es'
    ? 'Hola — necesitamos ver el frente de tu tarjeta del Seguro Social. Si no la tienes, una carta del Seguro Social que muestre tu número también funciona.'
    : "Hey — we need to see the front of your Social Security card. If you don't have it, a Social Security letter showing your number works too.";
  if (/employer name/i.test(l)) return lang === 'es'
    ? 'Hola — solo escribe el nombre de tu empleador actual. Si tienes más de un trabajo, incluye todos.'
    : "Hey — just type your current employer's name. If you have more than one job, include all of them.";
  if (/digital wallet|venmo|paypal|cash app/i.test(l)) return lang === 'es'
    ? 'Hola — si has usado Venmo, PayPal o Cash App, el tribunal necesita ver esa actividad también. Expande la app que usas abajo.'
    : "Hey — if you've used Venmo, PayPal, or Cash App, the court needs to see that activity too. Expand the app you use below.";
  if (/mortgage/i.test(l)) return lang === 'es'
    ? 'Hola — esto es el estado de cuenta mensual de tu hipoteca — no la escritura. Búscalo en el correo o en el portal en línea de tu prestamista.'
    : "Hey — this is your monthly mortgage statement — not the deed. Find it in the mail or your lender's online portal.";
  if (/vehicle|car|auto/i.test(l)) return lang === 'es'
    ? 'Hola — necesitamos el título del vehículo o el registro más reciente para cualquier vehículo que poseas.'
    : 'Hey — we need the vehicle title or most recent registration for any vehicle you own.';
  return lang === 'es'
    ? 'Hola — ¿qué puedo ayudarte a encontrar? Puedo decirte dónde conseguir este documento o cómo debería verse.'
    : 'Hey — what can I help you find? I can tell you where to get this document or what it should look like.';
};

const ALEX_INTRO_EN = "Hey — what can I help you find? I can tell you where to get this document, what it should look like, or anything else you're stuck on.";
const ALEX_INTRO_ES = "Hola — ¿qué puedo ayudarte a encontrar? Puedo decirte dónde conseguir este documento, cómo debería verse, o cualquier otra cosa con la que estés atorado.";

type Provider = { name: string; url: string | null; hint: string };

const payrollProviders: Provider[] = [
  { name: 'ADP', url: 'https://my.adp.com/#/pay/statements', hint: 'Most common — used by large employers' },
  { name: 'Workday', url: 'https://www.myworkday.com', hint: 'Common at mid-to-large companies' },
  { name: 'Paychex', url: 'https://myapps.paychex.com', hint: 'Common at small businesses' },
  { name: 'Gusto', url: 'https://app.gusto.com/payroll_history', hint: 'Common at startups and small businesses' },
  { name: 'Paylocity', url: 'https://access.paylocity.com', hint: 'Common at mid-sized companies' },
  { name: "I'm not sure", url: null, hint: "I'll help you figure it out" },
];

type ProviderResponse = {
  message: string;
  steps: string[];
  url: string;
  buttonLabel: string;
};

const paystubProviderResponses: Record<string, ProviderResponse> = {
  ADP: {
    message: "Here's how to get your pay stubs from ADP:",
    steps: [
      'Log into your ADP account',
      'Click Pay in the top navigation',
      'Select Pay Statements',
      'Download each stub from the last 2 months as PDF',
    ],
    url: 'https://my.adp.com/#/pay/statements',
    buttonLabel: 'Open ADP Pay Statements →',
  },
  Workday: {
    message: "Here's how to get your pay stubs from Workday:",
    steps: [
      'Log into your Workday account',
      'Click your name in the top right',
      'Select Pay → Payslips',
      'Download each payslip from the last 2 months',
    ],
    url: 'https://www.myworkday.com',
    buttonLabel: 'Open Workday →',
  },
  Paychex: {
    message: "Here's how to get your pay stubs from Paychex:",
    steps: [
      'Log into Paychex Flex',
      'Click Pay in the left menu',
      'Select Pay History',
      'Download each stub from the last 2 months as PDF',
    ],
    url: 'https://myapps.paychex.com',
    buttonLabel: 'Open Paychex Flex →',
  },
  Gusto: {
    message: "Here's how to get your pay stubs from Gusto:",
    steps: [
      'Log into your Gusto account',
      'Click Documents in the left menu',
      'Select Pay Stubs',
      'Download each stub from the last 2 months',
    ],
    url: 'https://app.gusto.com/payroll_history',
    buttonLabel: 'Open Gusto →',
  },
  Paylocity: {
    message: "Here's how to get your pay stubs from Paylocity:",
    steps: [
      'Log into your Paylocity account',
      'Click Pay in the top menu',
      'Select Pay History',
      'Download each stub from the last 2 months as PDF',
    ],
    url: 'https://access.paylocity.com',
    buttonLabel: 'Open Paylocity →',
  },
};

const w2ProviderResponses: Record<string, ProviderResponse> = {
  ADP: {
    message: "Here's how to get your W-2 from ADP:",
    steps: [
      'Log into your ADP account',
      'Click Pay in the top navigation',
      'Select Tax Statements',
      'Download your W-2 for 2024 and 2023',
    ],
    url: 'https://my.adp.com/#/pay/tax-statements',
    buttonLabel: 'Open ADP Tax Statements →',
  },
  Workday: {
    message: "Here's how to get your W-2 from Workday:",
    steps: [
      'Log into your Workday account',
      'Click Pay → Tax Documents',
      'Find your W-2 for 2024 and 2023',
      'Download each as a PDF',
    ],
    url: 'https://www.myworkday.com',
    buttonLabel: 'Open Workday →',
  },
  Paychex: {
    message: "Here's how to get your W-2 from Paychex:",
    steps: [
      'Log into Paychex Flex',
      'Click Pay → Tax Documents',
      'Download your W-2 for 2024 and 2023',
    ],
    url: 'https://myapps.paychex.com',
    buttonLabel: 'Open Paychex Flex →',
  },
  Gusto: {
    message: "Here's how to get your W-2 from Gusto:",
    steps: [
      'Log into your Gusto account',
      'Click Documents → Tax Documents',
      'Download your W-2 for 2024 and 2023',
    ],
    url: 'https://app.gusto.com/tax_documents',
    buttonLabel: 'Open Gusto Tax Documents →',
  },
  Paylocity: {
    message: "Here's how to get your W-2 from Paylocity:",
    steps: [
      'Log into your Paylocity account',
      'Click Pay → Tax Documents',
      'Download your W-2 for 2024 and 2023',
    ],
    url: 'https://access.paylocity.com',
    buttonLabel: 'Open Paylocity →',
  },
};

const taxReturnSources = [
  { name: 'TurboTax', url: 'https://myturbotax.intuit.com' },
  { name: 'H&R Block', url: 'https://www.hrblock.com/tax-center' },
  { name: 'TaxAct', url: 'https://www.taxact.com/myaccount' },
  { name: 'IRS Free Transcript', url: 'https://www.irs.gov/individuals/get-transcript' },
];

const paystubExample = `A pay stub is a document from your employer showing your earnings for one pay period. It shows:

- Your name and employer name at the top
- Pay period dates (e.g. April 1–15, 2026)
- Gross pay, taxes withheld, and net pay
- Usually has 'Earnings Statement' or 'Pay Statement' in the header

Make sure to upload one for each pay period in the last 2 months. If you're paid every 2 weeks, that's 4-5 stubs.`;

const w2Example = `A W-2 is a tax form your employer sends you every January showing your total earnings and taxes for the prior year. It's one page, says 'W-2 Wage and Tax Statement' at the top, and has boxes labeled 1 through 20.

You need your W-2 for 2024 and 2023. If you changed jobs, upload a W-2 from each employer.`;

const DocumentHelpChat = ({
  documentLabel,
  category,
  chapterType,
  isOpen,
  onOpenChange,
  language = 'en',
  bankExtraUpload,
  quantityInstruction,
  proactiveMessage,
  onProactiveMessageShown,
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

  const isW2 = documentLabel === 'W-2s (Last 2 Years)';
  const isPaystubs = documentLabel === 'Pay Stubs (Last 2 Months)';
  const isTaxReturns = /tax return/i.test(documentLabel);
  const isBankStatements = /checking\/savings statements|bank statements/i.test(documentLabel);
  const hasPayrollFlow = isW2 || isPaystubs;

  useEffect(() => {
    setMessages([{ role: 'assistant', content: getStepIntro(documentLabel, language), kind: 'text' }]);
    setInput('');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentLabel, language]);

  useEffect(() => {
    if (!proactiveMessage) return;
    setMessages(prev => [...prev, { role: 'assistant', content: proactiveMessage, kind: 'text', animate: true }]);
    onProactiveMessageShown?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proactiveMessage]);

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

  const handleClose = () => {
    setOpen(false);
  };

  const pushMessages = (...m: ChatMessage[]) => setMessages((prev) => [...prev, ...m]);

  const handleWhereDoIGetThis = () => {
    if (hasPayrollFlow) {
      pushMessages(
        { role: 'user', content: 'Where do I get this?' },
        {
          role: 'assistant',
          kind: 'text',
          animate: true,
          content: isW2
            ? "Your W-2 comes from your employer's payroll portal. Which one does your company use? I'll take you straight there."
            : "Pay stubs come from your employer's payroll portal. Which one does your company use? I'll take you straight there.",
        },
        { role: 'assistant', kind: 'provider-picker' },
      );
    } else if (isTaxReturns) {
      pushMessages(
        { role: 'user', content: 'Where do I get this?' },
        { role: 'assistant', kind: 'tax-sources', animate: true },
      );
    }
  };

  const handleWhatShouldThisLookLike = () => {
    const text = isW2 ? w2Example : paystubExample;
    pushMessages(
      { role: 'user', content: 'What should this look like?' },
      { role: 'assistant', kind: 'text', content: text, animate: true },
    );
  };

  const handleProviderSelect = (p: Provider) => {
    pushMessages({ role: 'user', content: p.name });
    if (p.url === null) {
      pushMessages({ role: 'assistant', kind: 'not-sure', animate: true });
      return;
    }
    const map = isW2 ? w2ProviderResponses : paystubProviderResponses;
    const resp = map[p.name];
    if (!resp) return;
    pushMessages({ role: 'assistant', kind: 'provider-steps', payload: resp });
  };

  const handleMultiBank = () => {
    pushMessages(
      { role: 'user', content: 'I have accounts at multiple banks' },
      {
        role: 'assistant',
        kind: 'text',
        animate: true,
        content:
          "No problem — connect your main bank with Plaid first, then you can upload PDF statements from your other banks manually below. Most attorneys need statements from every account you have, including savings accounts, credit unions, and online banks like Chime or Cash App.",
      },
      { role: 'assistant', kind: 'multi-bank' },
    );
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    // Short-circuit: quantity questions
    const lower = text.toLowerCase();
    if (
      quantityInstruction &&
      (lower.includes('how many') || lower.includes('how much') || lower.includes('months'))
    ) {
      pushMessages({
        role: 'assistant',
        kind: 'text',
        animate: true,
        content: `Your attorney needs ${quantityInstruction} for this document. When in doubt upload more rather than less.`,
      });
      return;
    }

    setLoading(true);

    try {
      const apiMessages = updatedMessages
        .filter((m) => m.kind === undefined || m.kind === 'text')
        .filter((m, i) => !(i === 0 && m.role === 'assistant' && m.content === ALEX_INTRO))
        .map((m) => ({ role: m.role, content: m.content || '' }));

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
      pushMessages({ role: 'assistant', content: aiResponse, kind: 'text', animate: true });
    } catch (err) {
      console.error('Chat error:', err);
      pushMessages({
        role: 'assistant',
        kind: 'text',
        animate: true,
        content: "I'm having trouble right now. Please follow the written steps above or contact your attorney's office.",
      });
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
      .filter((m) => m.kind === undefined || m.kind === 'text')
      .filter((m, i) => !(i === 0 && m.role === 'assistant' && m.content === ALEX_INTRO))
      .map((m) => ({ role: m.role, content: m.content || '' }));

    supabase.functions
      .invoke('document-agent-help', {
        body: { document_category: documentLabel, chapter_type: chapterType, messages: apiMessages, language },
      })
      .then(({ data, error }) => {
        const aiResponse = error ? "I'm having trouble right now." : data?.response || "I'm having trouble right now.";
        pushMessages({ role: 'assistant', content: aiResponse, kind: 'text', animate: true });
      })
      .catch(() => {
        pushMessages({ role: 'assistant', content: "I'm having trouble right now.", kind: 'text', animate: true });
      })
      .finally(() => setLoading(false));
  };

  const renderProviderPicker = () => (
    <div className="flex flex-col gap-2 mt-2 w-full">
      {payrollProviders.map((p) => (
        <button
          key={p.name}
          onClick={() => handleProviderSelect(p)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-left"
        >
          <span className="font-medium">{p.name}</span>
          <span className="text-xs text-muted-foreground ml-2">{p.hint}</span>
        </button>
      ))}
    </div>
  );

  const renderProviderSteps = (response: ProviderResponse) => (
    <div className="space-y-3">
      <p className="text-sm">{response.message}</p>
      <ol className="space-y-1">
        {response.steps.map((step, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="text-primary font-medium flex-shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <a
        href={response.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors mt-1"
      >
        {response.buttonLabel}
      </a>
      <p className="text-xs text-muted-foreground text-center">
        Opens in a new tab — come back here to upload once you've downloaded your {isW2 ? 'W-2s' : 'stubs'}
      </p>
    </div>
  );

  const renderNotSure = () => (
    <div className="space-y-3">
      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0">
        <p>No problem — check your email for a welcome message from your payroll provider when you first started your job. It'll say ADP, Workday, Paychex, Gusto, Paylocity, or something else.</p>
        <p className="mt-2">You can also ask your HR department or manager — they'll know right away.</p>
        <p className="mt-2">Or check your last paper pay stub if you have one — the company name is usually printed at the top.</p>
      </div>
      {renderProviderPicker()}
    </div>
  );

  const renderTaxSources = () => (
    <div className="space-y-3">
      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0">
        <p>Your tax returns come from wherever you filed:</p>
        <ul className="mt-1">
          <li><strong>TurboTax</strong> — Tax Home → Download/Print Return</li>
          <li><strong>H&amp;R Block</strong> — Account → Tax History</li>
          <li><strong>TaxAct</strong> — Prior Year Returns</li>
          <li><strong>Filed with an accountant</strong> — contact them directly for a copy</li>
          <li><strong>IRS.gov</strong> — free transcript at irs.gov/individuals/get-transcript</li>
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        {taxReturnSources.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <span className="font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">Open →</span>
          </a>
        ))}
      </div>
    </div>
  );

  const renderAssistantBody = (msg: ChatMessage, i: number) => {
    if (msg.kind === 'provider-picker') return renderProviderPicker();
    if (msg.kind === 'provider-steps') return renderProviderSteps(msg.payload as ProviderResponse);
    if (msg.kind === 'not-sure') return renderNotSure();
    if (msg.kind === 'tax-sources') return renderTaxSources();
    if (msg.kind === 'multi-bank') {
      return (
        <div className="space-y-2">
          {bankExtraUpload ? (
            bankExtraUpload
          ) : (
            <p className="text-xs text-muted-foreground">
              Use the upload area on this step to add statements from your other banks.
            </p>
          )}
        </div>
      );
    }
    // text
    if (msg.animate) {
      return (
        <TypewriterMarkdown
          text={msg.content || ''}
          onTick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          onDone={() => {
            setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, animate: false } : m)));
          }}
        />
      );
    }
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:mt-1 [&_ol]:mt-1">
        <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
      </div>
    );
  };

  const handleQuickQuestion = (q: string) => {
    setInput(q);
    setTimeout(() => {
      setInput('');
      const userMsg: ChatMessage = { role: 'user', content: q };
      setMessages(prev => [...prev, userMsg]);
      (async () => {
        setLoading(true);
        try {
          const apiMessages = [...messages, userMsg]
            .filter((m) => m.kind === undefined || m.kind === 'text')
            .filter((m, i) => !(i === 0 && m.role === 'assistant'))
            .map((m) => ({ role: m.role, content: m.content || '' }));
          const { data, error } = await supabase.functions.invoke('document-agent-help', {
            body: { document_category: documentLabel, chapter_type: chapterType, messages: apiMessages, language },
          });
          if (error) throw error;
          const aiResponse = data?.response || "I'm having trouble right now. Please try again.";
          pushMessages({ role: 'assistant', content: aiResponse, kind: 'text', animate: true });
        } catch (err) {
          console.error('Chat error:', err);
          pushMessages({ role: 'assistant', kind: 'text', animate: true, content: "I'm having trouble right now." });
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
  };

  const contextualSuggestions: string[] = (() => {
    if (language === 'es') {
      if (hasPayrollFlow) return ['¿Dónde encuentro esto?', '¿Cómo se ve?', '¿Cuántos necesito?'];
      if (isTaxReturns) return ['¿Dónde encuentro esto?', '¿Necesito todas las páginas?', 'Usé un preparador'];
      if (isBankStatements) return ['Tengo cuentas en varios bancos', '¿Y mi cuenta de ahorros?', '¿Puedo subir capturas?'];
      return ['¿Dónde encuentro esto?', '¿Cómo se ve?', '¿Puedo usar una captura?'];
    }
    if (isPaystubs) return ['Where do I get this?', 'What should this look like?', 'How many months?', 'I get paid in cash'];
    if (isW2) return ['Where do I get this?', 'What should this look like?', 'I never got mine', 'Get from IRS'];
    if (isTaxReturns) return ['Where do I get this?', 'Do I need every page?', 'I used a tax preparer', 'I haven\'t filed recently'];
    if (isBankStatements) return ['I have multiple banks', 'What about savings?', 'Can I upload screenshots?', 'How far back?'];
    return ['Where do I find this?', 'What should this look like?', 'Can I use a screenshot?'];
  })();

  const quickQuestions = contextualSuggestions;

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
                    {msg.role === 'assistant' ? renderAssistantBody(msg, i) : msg.content}
                  </div>
                </div>
              ))}

              {/* Quick suggestions after intro message */}
              {messages.length === 1 && messages[0].content === ALEX_INTRO && !loading && (
                <div className="flex flex-wrap gap-2 pl-8">
                  {(hasPayrollFlow || isTaxReturns) && (
                    <button
                      onClick={handleWhereDoIGetThis}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
                    >
                      {language === 'es' ? '¿Dónde encuentro esto?' : 'Where do I get this?'}
                    </button>
                  )}
                  {hasPayrollFlow && (
                    <button
                      onClick={handleWhatShouldThisLookLike}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
                    >
                      {language === 'es' ? '¿Cómo se ve?' : 'What should this look like?'}
                    </button>
                  )}
                  {isBankStatements && (
                    <button
                      onClick={handleMultiBank}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
                    >
                      I have accounts at multiple banks
                    </button>
                  )}
                  {quickQuestions.map((q) => (
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
