# src/i18n — Internationalization

> Locale string management and translation support.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| locales.ts | locales.ts | Locale string loading and lookup |

## Conventions

- - Locale files are JSON in src/i18n/locales/
- - Fallback chain: requested → en → hard-coded default

## Anti-Patterns

- - No hardcoded user-facing strings outside i18n module
