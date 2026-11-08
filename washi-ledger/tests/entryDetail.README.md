# B-90 regression checks

- `node --test tests/entriesCache.test.cjs`: account-scoped successful-save cache updates; no browser or network required.
- `node tests/entryDetail.browser.cjs`: runs the real Vite application in an isolated Chromium browser. All external HTTP/WebSocket connections are mocked or blocked; only synthetic account/ledger data is used.

The browser check needs Playwright. It can use an existing installation via `PLAYWRIGHT_MODULE` (module path) and `BROWSER_EXECUTABLE` (Chrome/Chromium path), without adding production dependencies. Otherwise it loads `playwright` normally and uses its installed Chromium. The project `.env` is used for request matching and the Vite server configuration; no real credentials or services are exercised.

The 11 browser scenarios cover editing and delayed synchronization through all five detail entry points, moving records outside date/category filters, copy, cancel, rejected save, and delete cancellation/confirmation. Other-account cache preservation is checked on every basic edit.

Optional environment variables: `B90_CASE` filters scenario names by substring; `B90_RESULTS_FILE` writes a JSON report. Browser checks use local port 5261.
