# TODO

## Backups must be enabled before real orders (BLOCKER for go-live)

- The `backup` service is behind the compose profile `backup` (off by default) until the GPG public key is imported and the private backup group exists.
- **Before taking real orders:** create the private backup group, import the GPG public key, set `BACKUP_GPG_RECIPIENT` and `BACKUP_TELEGRAM_CHAT_ID` in `deploy/.env`, run `docker compose --profile backup up -d`, run `backup.sh db` once, and do the restore drill from docs/deploy.md §9.
- Delivery is Telegram `sendDocument` (cloud Bot API: 50 MB limit). The weekly media archive will outgrow that: set `RCLONE_REMOTE` (Storage Box) or `TELEGRAM_API_BASE` to a local telegram-bot-api (2 GB). Until then a too-large media archive fails loudly (alert), it is never dropped silently.

## Flaky db-tests under load (PGlite hook timeout)

- **Symptom:** in a full `npm test` run, `db-tests/create-order.test.ts` and `db-tests/set-order-status.test.ts` fail with `Hook timed out in 10000ms` (followed by `Cannot read properties of undefined (reading 'close')` from the teardown). Run alone (`npx vitest run db-tests`) they pass (23 passed, 5 skipped).
- **Likely cause:** PGlite start-up plus applying all `db/migrations/*.sql` in `beforeAll` exceeds vitest's default 10s `hookTimeout` when many test files run in parallel.
- **Not caused by the light-theme work** (seen while verifying it; `db/`, `api/`, `shared/` untouched).
- **Candidate fixes (not applied yet):** raise `hookTimeout` for `db-tests` in `vitest.config.ts`; guard the `afterAll` `close()` against an undefined handle; or cap file parallelism for `db-tests`. It should be fixed before CI runs for the first time, since the repo has never been pushed.
