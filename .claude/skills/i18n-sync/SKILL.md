---
name: i18n-sync
description: Use when adding or modifying UI text in any language — ensures all 4 languages (FR/DE/EN/IT) stay in sync
---

# i18n Sync Workflow

## Overview

MEGGA supports 4 languages: Français (FR), Deutsch (DE), English (EN), Italiano (IT). Every UI string must exist in all 4 locales.

**Core principle:** If you add a key in FR, you add it in DE, EN, and IT in the same commit.

## When to Use

- Adding new UI text (labels, buttons, placeholders, errors, empty states)
- Modifying existing text
- Adding a new namespace
- Audit for missing translations

## File Structure

```
src/i18n/locales/
  fr/   # Français — SOURCE OF TRUTH
    common.json
    dashboard.json
    settings.json
    contacts.json
    pipeline.json
    listings.json
    kyc.json
    messages.json
    calendar.json
    matching.json
    automation.json
    documents.json
  de/   # Deutsch
  en/   # English
  it/   # Italiano
```

12 namespaces per language = 48 JSON files total.

## Workflow

### 1. Write the French Key First

FR is the source of truth (Swiss Romande market). Always start here.

```json
// fr/contacts.json
{
  "newContact": "Nouveau contact",
  "importContacts": "Importer des contacts"
}
```

### 2. Translate to All 3 Other Languages

```json
// de/contacts.json
{
  "newContact": "Neuer Kontakt",
  "importContacts": "Kontakte importieren"
}

// en/contacts.json
{
  "newContact": "New contact",
  "importContacts": "Import contacts"
}

// it/contacts.json
{
  "newContact": "Nuovo contatto",
  "importContacts": "Importa contatti"
}
```

### 3. Use in Components

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation('contacts')
  return <button>{t('newContact')}</button>
}
```

## Translation Quality Rules

### Swiss German (DE)
- Use standard Hochdeutsch, not Swiss dialect
- Real estate terms: Wohnung (apartment), Haus (house), Zimmer (rooms), Fläche (surface)
- Currency: always CHF, Swiss format with apostrophe (CHF 720'000)
- Formal "Sie" form, never "du"

### English (EN)
- British English preferred (Swiss context)
- "Flat" acceptable but "Apartment" preferred for consistency
- Keep technical real estate terms: mortgage, equity, down payment

### Italian (IT)
- Standard Italian (Ticino market)
- Formal "Lei" form
- Real estate: appartamento, casa, villa, locali (rooms)

### French (FR) — Source
- Swiss French conventions
- "Pièces" (not "chambres" for total rooms)
- Formal "vous" form
- Real estate: appartement, villa, maison, surface habitable

## Sync Verification

After adding keys, verify all 4 files have the same keys:

```bash
# Quick check — count keys per file
for lang in fr de en it; do
  echo "$lang: $(cat src/i18n/locales/$lang/NAMESPACE.json | grep -c '\":')"
done
```

All 4 numbers must match.

## Anti-Patterns

- **FR only**: Adding text in French and forgetting other languages
- **Google Translate**: Machine translation without checking Swiss real estate terminology
- **Hardcoded strings**: UI text directly in JSX instead of `t('key')`
- **Missing namespace import**: `useTranslation()` without specifying the namespace
- **Nested keys too deep**: Max 2 levels (`section.key`, not `section.subsection.key.detail`)

## Adding a New Namespace

1. Create the JSON file in all 4 locale directories
2. Register in `src/i18n/index.ts` (resources config)
3. Use `useTranslation('newNamespace')` in components
