.PHONY: up down migrate install discover sync stats web test fmt deploy-migrate push-companies

up:        ## start postgres
	docker compose up -d
	@until docker compose exec -T postgres pg_isready -U jobsite >/dev/null 2>&1; do sleep 1; done
	@echo "postgres ready on :5433"

down:
	docker compose down

migrate: up
	./db/migrate.sh

install:
	cd workers && python3 -m venv .venv && ./.venv/bin/pip install -q -e . pytest
	cd web && npm install

discover:
	cd workers && ./.venv/bin/jobsite discover --seeds ../db/seed/companies.txt

sync:
	cd workers && ./.venv/bin/jobsite sync

stats:
	cd workers && ./.venv/bin/jobsite stats

schedule:
	cd workers && ./.venv/bin/python -m jobsite.scheduler

web:
	cd web && npm run dev

test:
	cd workers && ./.venv/bin/python -m pytest tests/ -q

# --- public deployment (DEPLOY_URL = the Neon connection string) ---------------

deploy-migrate:  ## apply migrations to the deployed database
	@test -n "$(DEPLOY_URL)" || (echo "set DEPLOY_URL=postgresql://..." && exit 1)
	MIGRATE_URL="$(DEPLOY_URL)" ./db/migrate.sh

push-companies:  ## copy the companies list to the deployed database (new ones only)
	@test -n "$(DEPLOY_URL)" || (echo "set DEPLOY_URL=postgresql://..." && exit 1)
	@# One shell inside the container: piping between two `docker compose exec`
	@# processes truncated the stream mid-statement.
	docker compose exec -T -e DEPLOY_URL="$(DEPLOY_URL)" postgres sh -c \
	  'pg_dump -U jobsite -d jobsite --data-only --inserts --on-conflict-do-nothing \
	     --table=companies | psql "$$DEPLOY_URL" -q -v ON_ERROR_STOP=1'
	@echo "companies pushed"
