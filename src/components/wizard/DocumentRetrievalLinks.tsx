import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';

interface RetrievalLink {
  label: string;
  url: string;
}

interface RetrievalConfig {
  links: RetrievalLink[];
  helperText: string;
}

const RETRIEVAL_CONFIGS: Record<string, RetrievalConfig> = {
  'Pay Stubs (Last 2 Months)': {
    links: [
      { label: 'ADP', url: 'https://workforcenow.adp.com' },
      { label: 'Paychex', url: 'https://mypaychex.com' },
      { label: 'Gusto', url: 'https://app.gusto.com' },
      { label: 'Workday', url: 'https://wd5.myworkday.com' },
    ],
    helperText: 'Not sure which one your employer uses? Check your pay stub email or ask your HR department.',
  },
  'W-2s (Last 2 Years)': {
    links: [
      { label: 'ADP', url: 'https://workforcenow.adp.com' },
      { label: 'Paychex', url: 'https://mypaychex.com' },
      { label: 'Gusto', url: 'https://app.gusto.com' },
      { label: 'Workday', url: 'https://wd5.myworkday.com' },
      { label: 'Get from IRS directly', url: 'https://irs.gov/individuals/get-transcript' },
    ],
    helperText: 'Most employers send W-2s in January. Check your email inbox or HR portal first.',
  },
  'Checking/Savings Statements (Last 6 Months)': {
    links: [
      { label: 'Chase', url: 'https://chase.com' },
      { label: 'Bank of America', url: 'https://bankofamerica.com' },
      { label: 'Wells Fargo', url: 'https://wellsfargo.com' },
      { label: 'Chime', url: 'https://chime.com' },
      { label: 'My bank is not listed', url: 'https://www.google.com/search?q=online+banking+statements' },
    ],
    helperText: 'Log into your bank, go to Statements or Documents, and download the last 6 months as PDF files.',
  },
  'Tax Returns (Last 2 Years)': {
    links: [
      { label: 'TurboTax', url: 'https://myturbotax.intuit.com' },
      { label: 'H&R Block', url: 'https://hrblock.com' },
      { label: 'TaxAct', url: 'https://taxact.com' },
      { label: 'Get IRS Transcript', url: 'https://irs.gov/individuals/get-transcript' },
    ],
    helperText: 'If you used a tax preparer, contact them directly and ask for a PDF copy of your return.',
  },
  'Credit Card Statements (Last 3 Months)': {
    links: [
      { label: 'Chase', url: 'https://chase.com' },
      { label: 'Capital One', url: 'https://capitalone.com' },
      { label: 'Citi', url: 'https://online.citibank.com' },
      { label: 'American Express', url: 'https://americanexpress.com' },
      { label: 'Discover', url: 'https://discover.com' },
    ],
    helperText: 'Log into each card\'s website, go to Statements, and download the last 3 months for each card.',
  },
  'Mortgage Statement or Lease': {
    links: [
      { label: 'Rocket Mortgage', url: 'https://rocketmortgage.com' },
      { label: 'Mr Cooper', url: 'https://mrcooper.com' },
      { label: 'Wells Fargo Mortgage', url: 'https://wellsfargo.com/mortgage' },
      { label: 'Find my servicer', url: 'https://consumerfinance.gov/find-a-housing-counselor' },
    ],
    helperText: 'Not sure who services your mortgage? Check your monthly payment statement or your bank account for the payee name.',
  },
  'Government-Issued ID': {
    links: [],
    helperText: 'Take a clear photo of the front of your driver\'s license or state ID in good lighting. Make sure all four corners are visible and the text is readable.',
  },
};

// Also match partial labels for variants
const getConfig = (label: string): RetrievalConfig | null => {
  if (RETRIEVAL_CONFIGS[label]) return RETRIEVAL_CONFIGS[label];
  if (label.includes('Pay Stub')) return RETRIEVAL_CONFIGS['Pay Stubs (Last 2 Months)'];
  if (label.includes('W-2')) return RETRIEVAL_CONFIGS['W-2s (Last 2 Years)'];
  if (label.includes('Checking') || label.includes('Savings') || label.includes('Bank Statement')) return RETRIEVAL_CONFIGS['Checking/Savings Statements (Last 6 Months)'];
  if (label.includes('Tax Return')) return RETRIEVAL_CONFIGS['Tax Returns (Last 2 Years)'];
  if (label.includes('Credit Card')) return RETRIEVAL_CONFIGS['Credit Card Statements (Last 3 Months)'];
  if (label.includes('Mortgage')) return RETRIEVAL_CONFIGS['Mortgage Statement or Lease'];
  if (label.includes('Government') || label.includes('ID') || label.includes('Driver')) return RETRIEVAL_CONFIGS['Government-Issued ID'];
  return null;
};

interface DocumentRetrievalLinksProps {
  itemLabel: string;
  caseId: string;
  clientName: string;
}

const DocumentRetrievalLinks = ({ itemLabel, caseId, clientName }: DocumentRetrievalLinksProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = getConfig(itemLabel);

  if (!config) return null;

  const handleLinkClick = (link: RetrievalLink) => {
    window.open(link.url, '_blank', 'noopener,noreferrer');

    // Log activity to Supabase
    supabase.from('activity_log').insert({
      case_id: caseId,
      event_type: 'checkpoint_completed',
      actor_role: 'client',
      actor_name: clientName,
      description: `${clientName} opened retrieval link for ${itemLabel} (${link.label})`,
    }).then(() => {});

    // Sync to Supabase
    supabase.from('activity_log').insert({
      case_id: caseId,
      event_type: 'checkpoint_completed',
      actor_role: 'client',
      actor_name: clientName,
      description: `${clientName} opened retrieval link for ${itemLabel} (${link.label})`,
    }).then(() => {});
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-primary/80 hover:text-primary transition-colors"
      >
        <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="font-medium">Get this document now</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              {config.links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.links.map((link) => (
                    <button
                      key={link.label}
                      onClick={() => handleLinkClick(link)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 hover:border-primary/50 transition-all"
                    >
                      {link.label}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {config.helperText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentRetrievalLinks;
