# TODO

## Flaky db-tests under load (PGlite hook timeout)

- **Symptom:** in a full `npm test` run, `db-tests/create-order.test.ts` and `db-tests/set-order-status.test.ts` fail with `Hook timed out in 10000ms` (followed by `Cannot read properties of undefined (reading 'close')` from the teardown). Run alone (`npx vitest run db-tests`) they pass (23 passed, 5 skipped).
- **Likely cause:** PGlite start-up plus applying all `db/migrations/*.sql` in `beforeAll` exceeds vitest's default 10s `hookTimeout` when many test files run in parallel.
- **Not caused by the light-theme work** (seen while verifying it; `db/`, `api/`, `shared/` untouched).
- **Candidate fixes (not applied yet):** raise `hookTimeout` for `db-tests` in `vitest.config.ts`; guard the `afterAll` `close()` against an undefined handle; or cap file parallelism for `db-tests`. It should be fixed before CI runs for the first time, since the repo has never been pushed.
