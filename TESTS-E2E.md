E2E tests (Playwright)
======================

This project contains a small set of Playwright headless tests that exercise the admin UI (client-side flows). They are designed to be safe to run in CI and do not require secrets because network calls are stubbed where necessary.

Run locally
-----------
1. Install deps:

   npm ci

2. Install Playwright browsers (required once):

   npx playwright install --with-deps

3. Run tests (default targets production site https://ace1.in):

   npm run test:e2e

4. To run against a staging or localhost site, set BASE_URL first:

   BASE_URL=http://localhost:3000 npm run test:e2e

CI
--
The repository includes a GitHub Actions workflow that runs the tests on push/PR to main. Optionally set the `E2E_BASE_URL` secret for the test target; otherwise it defaults to https://ace1.in.

Notes
-----
- The tests are headless and stub network calls as needed so they can run without modifying production data. For deeper integration tests (full DB-backed flows) configure a staging environment and provide secrets to CI.
