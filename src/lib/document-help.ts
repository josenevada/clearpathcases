// ─── Contextual document help content ────────────────────────────────
// Pre-written plain English help for each document type in the wizard.

export interface DocumentHelpContent {
  whatIsThis: string;
  whereToFind: string;
  whatItLooksLike: string;
}

export const DOCUMENT_HELP: Record<string, DocumentHelpContent> = {
  'Pay Stubs (Last 2 Months)': {
    whatIsThis:
      'A pay stub is the document your employer gives you each time you get paid. It shows how much you earned, how much was taken out for taxes, and your year-to-date totals. Most employers call it a pay stub or earnings statement.',
    whereToFind:
      'Check your email for a message from your employer\'s payroll system — many companies send pay stubs digitally. Log into your company\'s HR or payroll portal such as ADP, Paychex, Gusto, or Workday. If you receive paper pay stubs, check your files or ask your employer for copies.',
    whatItLooksLike:
      'It is usually one page showing your name, your employer\'s name, the pay period dates, your gross pay, deductions, and net pay. It often has a section that tears off or is labeled "earnings statement."',
  },
  'W-2s (Last 2 Years)': {
    whatIsThis:
      'A W-2 is a tax form your employer sends you every January. It shows your total earnings for the previous year and how much was withheld for federal and state taxes. You need this to file your taxes each year.',
    whereToFind:
      'Check your email inbox for a message sent in January or February from your employer or their payroll provider. Log into your company\'s HR portal and look for a "Tax Documents" section. Check any mail you received between January and March. If you cannot find it, contact your HR or payroll department and ask for a copy — they are required by law to provide one. You can also request a wage and income transcript directly from the IRS at irs.gov/individuals/get-transcript.',
    whatItLooksLike:
      'It is a single page with numbered boxes from 1 to 20. Your employer\'s name and address appear at the top left. Your name and Social Security number appear at the bottom left. The tax year appears prominently at the top.',
  },
  'Checking/Savings Statements (Last 6 Months)': {
    whatIsThis:
      'A bank statement is a monthly summary from your bank showing all the money that came in and went out of your account during that month. We need the last six months of statements for all checking and savings accounts.',
    whereToFind:
      'Log into your bank\'s website or mobile app and look for a "Statements" or "Documents" section. Most banks let you download PDF statements going back at least one year. Common banks include Chase (chase.com), Bank of America (bankofamerica.com), Wells Fargo (wellsfargo.com), and Chime (chime.com). If you cannot find them online, call your bank\'s customer service line and ask them to email you your last six months of statements.',
    whatItLooksLike:
      'It is usually several pages showing your account number, your name, the statement period dates, a summary of your balance, and a list of every transaction.',
  },
  'Tax Returns (Last 2 Years)': {
    whatIsThis:
      'A tax return is the form you filed with the IRS showing your income and taxes for a given year. We need your returns for the last two years. This is the document you or your tax preparer completed — not the W-2 your employer sent you.',
    whereToFind:
      'If you filed online through TurboTax, H&R Block, TaxAct, or a similar service, log into your account and download your return as a PDF. If you used a tax preparer, contact them and ask for a copy. If you cannot find it, you can download a free transcript of your tax return directly from the IRS at irs.gov/individuals/get-transcript — select "Tax Return Transcript" and choose the year you need.',
    whatItLooksLike:
      'It is usually multiple pages starting with Form 1040. Your name and address appear at the top. Your total income and tax owed or refunded appear near the middle. It may have additional schedules attached.',
  },
  'Credit Card Statements (Last 3 Months)': {
    whatIsThis:
      'A credit card statement is the monthly bill from your credit card company showing your balance, minimum payment, and all transactions for that month. We need the last three months of statements for every credit card you have.',
    whereToFind:
      'Log into each credit card\'s website or app and look for a "Statements" or "Documents" section. Common issuers include Chase, Capital One, Citi, American Express, Discover, and Bank of America. Download the PDF statement for each of the last three months. If you cannot find them online, call the number on the back of your card and ask for your last three statements to be emailed to you.',
    whatItLooksLike:
      'It shows your name, account number (partially masked), statement date, balance, minimum payment due, and a list of all purchases and payments during the month.',
  },
  "Driver's License or State ID": {
    whatIsThis:
      'We need a clear photo of a valid government-issued photo ID to verify your identity. This can be your driver\'s license, state ID card, or passport.',
    whereToFind:
      'This is your physical ID card. Take a clear photo of the front of your driver\'s license or state ID in good lighting. Make sure all four corners are visible and the text is readable. If your ID is expired, you can still submit it — just let your attorney\'s office know. If you do not have a photo ID, contact your attorney\'s office before continuing.',
    whatItLooksLike:
      'A driver\'s license or state ID is a small card with your photo, name, address, date of birth, and an expiration date. A passport is a booklet — photograph the photo page which shows your picture and personal information.',
  },
  'Government-Issued Photo ID': {
    whatIsThis:
      'We need a clear photo of a valid government-issued photo ID to verify your identity. This can be your driver\'s license, state ID card, or passport.',
    whereToFind:
      'This is your physical ID card. Take a clear photo of the front of your driver\'s license or state ID in good lighting. Make sure all four corners are visible and the text is readable. If your ID is expired, you can still submit it — just let your attorney\'s office know. If you do not have a photo ID, contact your attorney\'s office before continuing.',
    whatItLooksLike:
      'A driver\'s license or state ID is a small card with your photo, name, address, date of birth, and an expiration date. A passport is a booklet — photograph the photo page which shows your picture and personal information.',
  },
  'Drivers License or State ID': {
    whatIsThis:
      'We need a clear photo of a valid government-issued photo ID to verify your identity. This can be your driver\'s license, state ID card, or passport.',
    whereToFind:
      'This is your physical ID card. Take a clear photo of the front of your driver\'s license or state ID in good lighting. Make sure all four corners are visible and the text is readable. If your ID is expired, you can still submit it — just let your attorney\'s office know. If you do not have a photo ID, contact your attorney\'s office before continuing.',
    whatItLooksLike:
      'A driver\'s license or state ID is a small card with your photo, name, address, date of birth, and an expiration date. A passport is a booklet — photograph the photo page which shows your picture and personal information.',
  },
  'Mortgage Statement': {
    whatIsThis:
      'A mortgage statement is the monthly bill from your mortgage lender showing how much you owe on your home loan, your monthly payment amount, and your current balance. If you rent instead of own, you do not need this.',
    whereToFind:
      'Log into your mortgage servicer\'s website or app. Common servicers include Mr. Cooper, Rocket Mortgage, Wells Fargo Home Mortgage, Chase Mortgage, and Nationstar. Look for a "Statements" or "Payment History" section and download your most recent statement as a PDF. If you cannot find it online, call your mortgage servicer and ask them to email you your most recent statement.',
    whatItLooksLike:
      'It shows your name, property address, loan number, current balance, next payment amount and due date, and a breakdown of principal and interest.',
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

  return null;
}

// Generate validation-aware contextual message
export function getValidationHelpMessage(validationStatus: string, suggestion?: string): string | null {
  if (validationStatus === 'warning') {
    if (suggestion?.toLowerCase().includes('year') || suggestion?.toLowerCase().includes('old')) {
      return 'This looks like it might be from the wrong year — here\'s how to find the correct one.';
    }
    return 'Something about this document didn\'t look quite right — here\'s what we\'re looking for.';
  }
  if (validationStatus === 'failed') {
    return 'This might not be the right document — here\'s what we\'re looking for and what it looks like.';
  }
  return null;
}
