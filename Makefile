.PHONY: up down migrate install discover sync stats web test fmt

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
