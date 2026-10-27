# Daily Blessings

A local, responsive reading companion for St. Mary Coptic Orthodox Church’s 2026–2027 Daily Blessings books. All seven source PDFs are retained in `data/`. Grades 3 and 4 share a book; students select their own grade independently.

## Run

Requires Node.js 20 or newer. No JavaScript packages need installing.

```sh
cd /Users/JosephShenouda/Daily_Blessing
node server.mjs
```

Open http://localhost:3000. The server binds only to this computer. Set `PORT=3001 node server.mjs` to use another port. Stop with Control-C. `node --watch server.mjs` watches server changes; refresh the browser after editing front-end files. npm shortcuts (`npm start`, `npm run dev`, `npm test`) are also provided. This Mac has an incompatible older Node binary in `/usr/local/bin` that npm can pick up; use the direct `node` commands above with the working Node installation.

## Features

- Grade selection opens today’s assignment and remembers the selected grade.
- Previous/next day, native date picker, month calendar, and return to today.
- Exact-year dates from the PDFs; assignments never roll into a different school year.
- Reading references, complete questions, weekly verses, Coptic dates, and feast notes.
- Direct links to the source PDF at the assignment’s physical PDF page.
- Search readings, questions, feast notes, or ISO dates for the selected grade.
- Browser-local reflections, completion tracking, weekly progress, journal history, and text export.
- Reading library with all original source books and their actual coverage dates.
- Keyboard navigation, visible focus states, native dialog, responsive layouts, and print styles.

There are no accounts or external services. Reflections are stored in this browser’s local storage and are not sent to the local server. Each grade has separate reflections and completion records. Clearing browser data removes them; export the journal to keep a copy. Shared browsers share the same journal. PDF books include reading references rather than full Bible passages, so this app does not supply additional Bible translations or invented answers.

## Source data

`public/assignments.json` contains structured assignments and provenance. `public/extraction-report.json` records source coverage, duplicate entries, gaps, and weekday validation. Every entry retains its full `originalText`, PDF filename, physical page number, and all repeated source pages.

| Grade | First assignment | Last assignment | Entries |
| --- | --- | --- | --- |
| 1 | September 26, 2026 | September 17, 2027 | 357 |
| 2 | September 5, 2026 | September 17, 2027 | 378 |
| 3 & 4 | October 3, 2026 | October 1, 2027 | 364 |
| 5–8 | September 5, 2026 | September 17, 2027 | 378 per book |

All seven books have uninterrupted coverage within their own ranges. Grades 1 and 2 each repeat three identical assignments in the PDF text; these are retained once and recorded in the report. Days without a printed reading or question remain in the calendar with their feast notes. The interface explicitly identifies dates outside the selected book’s range.

Extraction preserves source wording, spelling, punctuation, questions, and answer blanks. It normalizes whitespace and decodes PDF ligature artifacts such as `/f_i` to `fi`; source spelling errors are not corrected. The printed calendar dates and Coptic labels are retained rather than recalculated. Physical PDF page numbers include the cover and differ from printed page numbers.

To rebuild the structured data after changing PDFs:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/extract_assignments.py
```

The extractor fails on unrecognized dates or conflicting duplicate assignments. Review `extraction-report.json` after rebuilding.

## Online deployment

Build the static website with `node scripts/build.mjs`. The generated `dist/` directory includes all application assets, structured assignments, and all seven PDF books under `dist/data/`. It can be served by a static host without the local Node server. The Sites project identity is saved in `.openai/hosting.json`; reuse that project for future publications.

The hosted app keeps reflections and progress in each browser. Localhost journal entries are not transferred to the hosted site, and entries do not synchronize between devices. Export the journal to keep a separate copy.

## Verify

```sh
node --test tests/*.test.mjs
```

Tests cover date arithmetic, year boundaries, leap dates, all grade mappings, continuous source coverage, preservation of assignment wording, source provenance, and known daily assignments. HTTP tests check the running server separately.
