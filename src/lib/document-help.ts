// ─── Contextual document help content ────────────────────────────────
// Warm, plain-English help for each document type in the wizard.

export interface DocumentHelpContent {
  whatIsThis: string;
  whereToFind: string;
  whatItLooksLike: string;
}

export const DOCUMENT_HELP: Record<string, DocumentHelpContent> = {
  'Pay Stubs (Last 2 Months)': {
    whatIsThis:
      'A pay stub is the slip you get every payday. It shows what you earned, what was taken out for taxes, and your year-to-date totals. Your employer might call it an earnings statement.',
    whereToFind:
      'Check your email — a lot of companies send these digitally now. You can also log into your payroll portal (like ADP, Gusto, or Workday) and download them. If you get paper stubs, check your files at home or ask your employer for copies.',
    whatItLooksLike:
      'Usually one page with your name, your employer\'s name, the pay period, gross pay, deductions, and net pay. Sometimes it has a perforated tear-off section.',
  },
  'W-2s (Last 2 Years)': {
    whatIsThis:
      'Your W-2 is a tax form your employer sends you each January. It sums up everything you earned that year and how much was withheld for taxes. You use it to file your taxes.',
    whereToFind:
      'Check your email from January or February — your employer or payroll company probably sent it. You can also log into your HR portal and look under "Tax Documents." If you can\'t find it, call your HR department — they\'re required to give you a copy. You can also get a free transcript from the IRS at irs.gov/individuals/get-transcript.',
    whatItLooksLike:
      'A single page with numbered boxes. Your employer\'s info is at the top left, your name and Social Security number at the bottom left, and the tax year is printed prominently at the top.',
  },
  'Checking/Savings Statements (Last 6 Months)': {
    whatIsThis:
      'A bank statement is a monthly summary from your bank showing all the money that came in and went out. We need the last six months for every checking and savings account you have.',
    whereToFind:
      'Log into your bank\'s website or app and look for "Statements" or "Documents." Most banks let you download PDFs going back at least a year. If you bank with Chase, Bank of America, Wells Fargo, Chime, or anyone else — it\'s usually in the same spot. Can\'t find them? Call the number on the back of your debit card and ask.',
    whatItLooksLike:
      'Usually a few pages showing your account number, name, statement dates, opening and closing balance, and a list of every transaction that month.',
  },
  'Tax Returns (Last 2 Years)': {
    whatIsThis:
      'This is the form you (or your tax preparer) filed with the IRS — not the W-2 your employer sent you. We need the full return for the last two years.',
    whereToFind:
      'If you used TurboTax, H&R Block, or another online service, log in and download your return as a PDF. If you used a tax preparer, give them a call. If you can\'t find it anywhere, you can get a free transcript from the IRS at irs.gov/individuals/get-transcript.',
    whatItLooksLike:
      'Multiple pages starting with Form 1040. Your name and address are at the top, and your total income and taxes are in the middle. There might be extra schedules attached.',
  },
  'Credit Card Statements (Last 3 Months)': {
    whatIsThis:
      'Your credit card statement is the monthly bill showing your balance, minimum payment, and everything you charged that month. We need the last three months for every card you have.',
    whereToFind:
      'Log into each card\'s website or app and look for "Statements." Chase, Capital One, Citi, Amex, Discover — they all have them. Download the PDF for each of the last three months. If you can\'t find them, call the number on the back of your card.',
    whatItLooksLike:
      'Shows your name, a partially masked account number, the statement date, your balance, minimum payment, and a list of all charges and payments.',
  },
  "Driver's License or State ID": {
    whatIsThis:
      'We just need a clear photo of a government-issued ID to confirm your identity. A driver\'s license, state ID, or passport all work.',
    whereToFind:
      'Grab your physical ID and take a clear photo in good lighting. Make sure all four corners are visible and the text is easy to read. Expired? That\'s usually fine — just let your attorney\'s office know.',
    whatItLooksLike:
      'Your driver\'s license or state ID is a small card with your photo, name, address, and date of birth. If using a passport, photograph the page with your picture on it.',
  },
  'Government-Issued Photo ID': {
    whatIsThis:
      'We just need a clear photo of a government-issued ID to confirm your identity. A driver\'s license, state ID, or passport all work.',
    whereToFind:
      'Grab your physical ID and take a clear photo in good lighting. Make sure all four corners are visible and the text is easy to read. Expired? That\'s usually fine — just let your attorney\'s office know.',
    whatItLooksLike:
      'Your driver\'s license or state ID is a small card with your photo, name, address, and date of birth. If using a passport, photograph the page with your picture on it.',
  },
  'Drivers License or State ID': {
    whatIsThis:
      'We just need a clear photo of a government-issued ID to confirm your identity. A driver\'s license, state ID, or passport all work.',
    whereToFind:
      'Grab your physical ID and take a clear photo in good lighting. Make sure all four corners are visible and the text is easy to read. Expired? That\'s usually fine — just let your attorney\'s office know.',
    whatItLooksLike:
      'Your driver\'s license or state ID is a small card with your photo, name, address, and date of birth. If using a passport, photograph the page with your picture on it.',
  },
  'Mortgage Statement': {
    whatIsThis:
      'Your mortgage statement is the monthly bill from your home loan company. It shows your balance, monthly payment, and how much goes to principal versus interest. If you rent, you don\'t need this one.',
    whereToFind:
      'Log into your mortgage servicer\'s website — Mr. Cooper, Rocket Mortgage, Wells Fargo, Chase, etc. Look for "Statements" or "Payment History" and download the most recent one. You can also call and ask them to email it.',
    whatItLooksLike:
      'Shows your name, property address, loan number, current balance, and your next payment amount and due date.',
  },
  'Digital Wallet Statements': {
    whatIsThis:
      'If you\'ve used apps like Venmo, PayPal, or Cash App in the last year, those count as financial accounts. The court needs to see the transaction history, just like a bank account.',
    whereToFind:
      'Each app lets you download your statements or transaction history. We\'ll walk you through exactly how to get them — just expand the app cards on this page.',
    whatItLooksLike:
      'Usually a PDF or CSV file showing your transactions, dates, amounts, and who you sent money to or received money from.',
  },
};

// Fuzzy lookup for labels that don't exactly match
export function getDocumentHelp(label: string): DocumentHelpContent | null {
  if (DOCUMENT_HELP[label]) return DOCUMENT_HELP[label];

  const lower = label.toLowerCase();
  if (lower.includes('pay stub')) return DOCUMENT_HELP['Pay Stubs (Last 2 Months)'];
  if (lower.includes('w-2') || lower.includes('w2')) return DOCUMENT_HELP['W-2s (Last 2 Years)'];
  if (lower.includes('bank') || lower.includes('checking') || lower.includes('savings'))
    return DOCUMENT_HELP['Checking/Savings Statements (Last 6 Months)'];
  if (lower.includes('tax return')) return DOCUMENT_HELP['Tax Returns (Last 2 Years)'];
  if (lower.includes('credit card')) return DOCUMENT_HELP['Credit Card Statements (Last 3 Months)'];
  if (lower.includes('license') || lower.includes('state id') || lower.includes('photo id') || lower.includes('government'))
    return DOCUMENT_HELP["Driver's License or State ID"];
  if (lower.includes('mortgage')) return DOCUMENT_HELP['Mortgage Statement'];
  if (lower.includes('digital wallet') || lower.includes('venmo') || lower.includes('paypal') || lower.includes('cash app'))
    return DOCUMENT_HELP['Digital Wallet Statements'];

  return null;
}

