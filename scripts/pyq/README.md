# Penni PYQ importer

The importer converts a text-extracted UPSC PYQ book into Penni's structured,
year-chunked question bank. It detects complete four-option questions, matches
solutions by local concept overlap (to survive two-column PDF extraction), and
emits a manifest plus one JSON file per year.

```bash
node scripts/pyq/import-pw-book.mjs /path/to/extracted-book.txt
```

Generated files live in `app/public/data/pyq/`. Check `import-report.json`
after every import. Questions without a complete stem, four options, answer key,
and usable explanation are rejected rather than published with uncertain data.

Run the publish guard after an import:

```bash
node scripts/pyq/validate.mjs
```

The guard fails on duplicate IDs, malformed options or answer keys, short
solutions, and leaked PDF answer/footer text.
