# Integration Testing — Reference

For full architectural context, see:
- `docs/testing.md` — Testing infrastructure, StudioAgent API, selector conventions, fixture management

Key source files:
- `studio/test/StudioAgent.ts` — Primary test API
- `studio/test/TestDriver.ts` — WebDriverIO client wrapper
- `studio/test/integration/insiders/solution.test.ts` — Insiders solution tests (smoke)
- `studio/test/integration/stable/solutions.test.ts` — Stable solution tests (comprehensive multi-root)
- `studio/test/fixtures/` — Test fixture data
