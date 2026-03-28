

## Plan: Fix AI Form Filling Section Background & Card Styling

Two targeted changes in `src/pages/MarketingLanding.tsx`:

### Change 1 — Section background
**Line 475**: Change `aiFormFilling: '#0f1f2e'` → `aiFormFilling: '#0d1b2a'`

### Change 2 — Card styling
**Line 235**: Update the extraction card's inline style from:
```
background: '#111f2e', border: '1px solid rgba(0,194,168,0.15)'
```
to:
```
background: '#0f2035', border: '0.5px solid rgba(0,194,168,0.25)', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
```

Also on line 219, remove the `style={{ background: 'hsl(var(--background))' }}` from the inner `<section>` element so it doesn't override the parent wrapper's background.

No other files or sections affected.

