# Deploy

Full runbook (Uzbek): [`docs/deploy.md`](../docs/deploy.md) -- prerequisites, server
hardening, first deploy, backup/restore drill, updates, rollback, and
troubleshooting.

This directory holds everything `docker compose` needs on the server:
`docker-compose.yml`, `Dockerfile.api`, `Caddyfile`, `migrate.sh`, `backup.sh`,
and `.env.example` (copy to `.env`, which is gitignored -- see
`docs/deploy.md` §3).

## Everyday commands

Run from this directory (`deploy/`) on the server.

```bash
# Logs
docker compose logs -f api
docker compose logs -f caddy
docker compose logs -f postgres
docker compose logs -f backup

# Restart one service
docker compose restart api

# psql shell into the database
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
# (reads POSTGRES_USER/POSTGRES_DB from your shell env -- or just run
#  `set -a; source .env; set +a` first)

# Apply any new migrations (idempotent -- safe to re-run any time)
./migrate.sh

# Run a backup manually (db or media) -- backup.sh is bind-mounted
# read-only, so it's invoked via `bash`, not directly by path.
docker compose exec backup bash /usr/local/bin/backup.sh db
docker compose exec backup bash /usr/local/bin/backup.sh media

# Rebuild + redeploy after a code change
git pull
docker compose build api
docker compose up -d
./migrate.sh
```
