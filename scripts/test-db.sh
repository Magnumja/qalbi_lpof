#!/usr/bin/env bash
# Sobe um PostgreSQL temporário para os testes (banco qalbi_test) e imprime a URL.
# Uso: source <(scripts/test-db.sh)   ou   eval "$(scripts/test-db.sh)"
# Parar: pg_ctl -D "$QALBI_PGDATA" stop
set -euo pipefail
PORT="${QALBI_PG_PORT:-55432}"
DATA="$(mktemp -d /tmp/qalbi-postgres.XXXXXX)"
initdb -D "$DATA" -U qalbi --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DATA/log" start >/dev/null
createdb -h 127.0.0.1 -p "$PORT" -U qalbi qalbi_test
createdb -h 127.0.0.1 -p "$PORT" -U qalbi qalbi_dev
echo "export QALBI_PGDATA=$DATA"
echo "export TEST_DATABASE_URL=postgresql://qalbi@127.0.0.1:$PORT/qalbi_test"
echo "export DATABASE_URL=postgresql://qalbi@127.0.0.1:$PORT/qalbi_dev"
