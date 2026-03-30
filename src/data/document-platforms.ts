export interface Platform {
  id: string;
  name: string;
  logo_emoji: string;
  gif_url: string;
  deep_link_desktop: string;
  deep_link_mobile: string;
  instructions: string[];
  tip?: string;
}

export const DOCUMENT_PLATFORMS: Record<string, Platform[]> = {
  bank_statement: [
    {
      id: 'chase',
      name: 'Chase',
      logo_emoji: '🏦',
      gif_url: 'agent-gifs/chase-statements.gif',
      deep_link_desktop: 'https://secure.chase.com/web/auth/#/logon/logon/chaseOnline',
      deep_link_mobile: 'https://www.chase.com/digital/mobile-banking',
      instructions: [
        'Log into Chase at chase.com',
        'Click "Accounts" in the top menu',
        'Select your checking or savings account',
        'Click "Statements" on the left sidebar',
        'Download the last 6 monthly statements as PDF',
      ],
      tip: 'Download each month as a separate PDF file.',
    },
    {
      id: 'bofa',
      name: 'Bank of America',
      logo_emoji: '🏦',
      gif_url: 'agent-gifs/bofa-statements.gif',
      deep_link_desktop: 'https://www.bankofamerica.com/online-banking/sign-in/',
      deep_link_mobile: 'https://www.bankofamerica.com/online-banking/mobile-banking/',
      instructions: [
        'Log into Bank of America',
        'Click your account name',
        'Select "Statements & Documents"',
        'Choose "eStatements"',
        'Download the last 6 monthly statements as PDF',
      ],
      tip: 'Statements are available for up to 18 months online.',
    },
    {
      id: 'wells_fargo',
      name: 'Wells Fargo',
      logo_emoji: '🏦',
      gif_url: 'agent-gifs/wellsfargo-statements.gif',
      deep_link_desktop: 'https://connect.secure.wellsfargo.com/auth/login/present',
      deep_link_mobile: 'https://www.wellsfargo.com/mobile-banking/',
      instructions: [
        'Log into Wells Fargo',
        'Click "Accounts" then select your account',
        'Click "Statements & Documents"',
        'Download the last 6 months as PDF',
      ],
      tip: 'If you have multiple accounts download statements for all of them.',
    },
    {
      id: 'citi',
      name: 'Citi',
      logo_emoji: '🏦',
      gif_url: 'agent-gifs/citi-statements.gif',
      deep_link_desktop: 'https://online.citi.com/US/login.do',
      deep_link_mobile: 'https://www.citi.com/mobile/',
      instructions: [
        'Log into Citi online banking',
        'Click on your account',
        'Select "Statements" from the account menu',
        'Download the last 6 monthly statements',
      ],
    },
    {
      id: 'capital_one',
      name: 'Capital One',
      logo_emoji: '🏦',
      gif_url: 'agent-gifs/capitalone-statements.gif',
      deep_link_desktop: 'https://verified.capitalone.com/auth/signin',
      deep_link_mobile: 'https://www.capitalone.com/digital/mobile/',
      instructions: [
        'Log into Capital One',
        'Click your account',
        'Select "Account Services" then "Statements"',
        'Download the last 6 months as PDF',
      ],
    },
    {
      id: 'other_bank',
      name: 'Other / Not Sure',
      logo_emoji: '🏦',
      gif_url: 'agent-gifs/generic-bank.gif',
      deep_link_desktop: '',
      deep_link_mobile: '',
      instructions: [
        "Log into your bank's website",
        'Look for "Accounts" or "My Accounts"',
        'Find "Statements", "Documents", or "eStatements"',
        'Download the last 6 months as PDF',
        "If you can't find them, call your bank and ask for \"the last 6 months of statements in PDF format\"",
      ],
      tip: 'Most banks keep at least 12 months of statements available online.',
    },
  ],

  pay_stub: [
    {
      id: 'adp',
      name: 'ADP',
      logo_emoji: '💼',
      gif_url: 'agent-gifs/adp-paystubs.gif',
      deep_link_desktop: 'https://my.adp.com/',
      deep_link_mobile: 'https://my.adp.com/',
      instructions: [
        'Go to my.adp.com and log in',
        'Click "Pay" in the top navigation',
        'Click "Pay Statements"',
        'Click your most recent pay stub',
        'Click the download icon and save as PDF',
        'Repeat for your second most recent pay stub',
      ],
      tip: "Your ADP login is separate from your work email — check your inbox for an ADP setup invitation if you've never logged in before.",
    },
    {
      id: 'gusto',
      name: 'Gusto',
      logo_emoji: '💼',
      gif_url: 'agent-gifs/gusto-paystubs.gif',
      deep_link_desktop: 'https://app.gusto.com/login',
      deep_link_mobile: 'https://app.gusto.com/login',
      instructions: [
        'Log into Gusto at app.gusto.com',
        'Click "Pay Stubs" in the left sidebar',
        'Click your most recent pay stub',
        'Click "Download PDF"',
        'Repeat for your second most recent',
      ],
    },
    {
      id: 'paychex',
      name: 'Paychex',
      logo_emoji: '💼',
      gif_url: 'agent-gifs/paychex-paystubs.gif',
      deep_link_desktop: 'https://myapps.paychex.com/',
      deep_link_mobile: 'https://myapps.paychex.com/',
      instructions: [
        'Log into Paychex at myapps.paychex.com',
        'Click "Pay History" or "Payroll"',
        'Click your most recent pay stub',
        'Click "View" then save as PDF',
      ],
      tip: 'If you\'ve never logged in click "Register" and use your employee ID and last 4 of your SSN.',
    },
    {
      id: 'workday',
      name: 'Workday',
      logo_emoji: '💼',
      gif_url: 'agent-gifs/workday-paystubs.gif',
      deep_link_desktop: 'https://www.myworkday.com/',
      deep_link_mobile: 'https://www.myworkday.com/',
      instructions: [
        "Log into Workday — your company has a specific URL (ask HR if you don't have it)",
        'Click the menu icon top left',
        'Search for "Pay" or click "Pay" in the menu',
        'Click "Payslips"',
        'Download your 2 most recent payslips as PDF',
      ],
    },
    {
      id: 'rippling',
      name: 'Rippling',
      logo_emoji: '💼',
      gif_url: 'agent-gifs/rippling-paystubs.gif',
      deep_link_desktop: 'https://app.rippling.com/login',
      deep_link_mobile: 'https://app.rippling.com/login',
      instructions: [
        'Log into Rippling at app.rippling.com',
        'Click "Payroll" in the left menu',
        'Click "Pay Stubs"',
        'Download your 2 most recent pay stubs',
      ],
    },
    {
      id: 'paper_or_email',
      name: 'Paper / Email / Not Sure',
      logo_emoji: '📄',
      gif_url: 'agent-gifs/paper-stub.gif',
      deep_link_desktop: '',
      deep_link_mobile: '',
      instructions: [
        "Check your email inbox — search for your employer's name, pay stubs are often emailed automatically",
        'If you have paper pay stubs, take a clear photo showing all the numbers',
        "If neither works, ask your HR department for your last 2 pay stubs in PDF format — they're required to provide them",
      ],
      tip: 'Make sure any photo shows your name, employer name, pay period dates, and all dollar amounts clearly.',
    },
  ],

  tax_return: [
    {
      id: 'irs_online',
      name: 'IRS Website',
      logo_emoji: '🏛️',
      gif_url: 'agent-gifs/irs-transcript.gif',
      deep_link_desktop: 'https://www.irs.gov/individuals/get-transcript',
      deep_link_mobile: 'https://www.irs.gov/individuals/get-transcript',
      instructions: [
        'Go to irs.gov/individuals/get-transcript',
        'Click "Get Transcript Online"',
        'Create an account or log in',
        "You'll need: SSN, date of birth, email, and a financial account number to verify",
        'Select "Tax Return Transcript" for 2023 and 2022',
        'Download each as PDF',
      ],
      tip: 'An IRS transcript is accepted by attorneys and is faster than finding your original return.',
    },
    {
      id: 'turbotax',
      name: 'TurboTax',
      logo_emoji: '📊',
      gif_url: 'agent-gifs/turbotax-return.gif',
      deep_link_desktop: 'https://myturbotax.intuit.com/',
      deep_link_mobile: 'https://myturbotax.intuit.com/',
      instructions: [
        'Log into TurboTax at myturbotax.intuit.com',
        'Click "Tax Home" or "My Returns"',
        'Select 2023',
        'Click "Download/print return (PDF)"',
        'Repeat for 2022',
      ],
    },
    {
      id: 'hrblock',
      name: 'H&R Block',
      logo_emoji: '📊',
      gif_url: 'agent-gifs/hrblock-return.gif',
      deep_link_desktop: 'https://www.hrblock.com/tax-center/',
      deep_link_mobile: 'https://www.hrblock.com/tax-center/',
      instructions: [
        'Log into H&R Block at hrblock.com',
        'Go to "Tax History" or "Prior Year Returns"',
        'Select 2023 and click Download',
        'Repeat for 2022',
      ],
    },
    {
      id: 'tax_preparer',
      name: 'Tax Preparer / CPA',
      logo_emoji: '👤',
      gif_url: 'agent-gifs/tax-preparer.gif',
      deep_link_desktop: '',
      deep_link_mobile: '',
      instructions: [
        'Call or email your tax preparer or CPA',
        'Ask for a PDF copy of your 2022 and 2023 tax returns',
        'They are required by law to provide you a copy',
        'Most can email them within 24 hours',
      ],
      tip: 'Alternatively get a free transcript directly from the IRS in minutes — tap "IRS Website" above.',
    },
  ],

  retirement_statement: [
    {
      id: 'fidelity',
      name: 'Fidelity',
      logo_emoji: '📈',
      gif_url: 'agent-gifs/fidelity-statement.gif',
      deep_link_desktop: 'https://www.fidelity.com/go/login',
      deep_link_mobile: 'https://www.fidelity.com/go/login',
      instructions: [
        'Log into Fidelity at fidelity.com',
        'Click "Accounts & Trade" then "Account Positions"',
        'Click "Statements" in the left menu',
        'Select your most recent quarterly statement',
        'Download as PDF',
      ],
      tip: 'Make sure the statement shows your account balance and account type (401k, IRA, etc).',
    },
    {
      id: 'vanguard',
      name: 'Vanguard',
      logo_emoji: '📈',
      gif_url: 'agent-gifs/vanguard-statement.gif',
      deep_link_desktop: 'https://investor.vanguard.com/home/',
      deep_link_mobile: 'https://investor.vanguard.com/home/',
      instructions: [
        'Log into Vanguard',
        'Click "My Accounts" then select your account',
        'Click "Statements & tax forms"',
        'Download your most recent account statement',
      ],
    },
    {
      id: 'schwab',
      name: 'Charles Schwab',
      logo_emoji: '📈',
      gif_url: 'agent-gifs/schwab-statement.gif',
      deep_link_desktop: 'https://www.schwab.com/client-home',
      deep_link_mobile: 'https://www.schwab.com/client-home',
      instructions: [
        'Log into Schwab',
        'Click "Accounts" then "Statements"',
        'Select your retirement account',
        'Download the most recent statement as PDF',
      ],
    },
    {
      id: 'employer_401k',
      name: 'Through My Employer',
      logo_emoji: '🏢',
      gif_url: 'agent-gifs/employer-401k.gif',
      deep_link_desktop: '',
      deep_link_mobile: '',
      instructions: [
        "Log into your employer's HR or benefits portal",
        'Look for "Retirement", "401k", or "Benefits"',
        'Find your account statement or balance',
        'Download showing your account type and current balance',
        "If you can't find it contact HR — ask for your most recent 401k statement",
      ],
      tip: 'Your 401k provider is often listed on your pay stub under retirement deductions.',
    },
  ],
};

// Map checklist item labels to document category keys
const LABEL_TO_CATEGORY: Record<string, string> = {
  'Checking/Savings Statements (Last 6 Months)': 'bank_statement',
  'Pay Stubs (Last 2 Months)': 'pay_stub',
  'Tax Returns (Last 2 Years)': 'tax_return',
  'Investment/Retirement Statements': 'retirement_statement',
};

export const getDocumentCategory = (itemLabel: string): string | null => {
  if (LABEL_TO_CATEGORY[itemLabel]) return LABEL_TO_CATEGORY[itemLabel];
  if (itemLabel.includes('Checking') || itemLabel.includes('Savings') || itemLabel.includes('Bank Statement')) return 'bank_statement';
  if (itemLabel.includes('Pay Stub')) return 'pay_stub';
  if (itemLabel.includes('Tax Return')) return 'tax_return';
  if (itemLabel.includes('Investment') || itemLabel.includes('Retirement')) return 'retirement_statement';
  return null;
};

export const CATEGORY_LABELS: Record<string, string> = {
  bank_statement: 'bank statements',
  pay_stub: 'pay stubs',
  tax_return: 'tax returns',
  retirement_statement: 'retirement statements',
};
