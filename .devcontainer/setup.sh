#!/usr/bin/env bash
# Libra Codespace setup — clones sibling repos, installs deps, starts Postgres.
# Re-run safe: each step is idempotent.
set -euo pipefail

WORKSPACE="${CODESPACE_VSCODE_FOLDER:-/workspaces/libra-frontend}"
PARENT="$(dirname "$WORKSPACE")"
cd "$PARENT"

echo "==> 1/7 Cloning sibling repos under $PARENT"
for repo in libra-backend libra-agent libra-ingest; do
  if [ ! -d "$repo" ]; then
    git clone --depth 1 "https://github.com/KW-Libra/$repo.git" "$repo"
  else
    echo "    $repo already present, skipping clone"
  fi
done

echo "==> 2/7 Installing uv (Python package manager)"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"

echo "==> 3/7 Starting Postgres via libra-backend/docker-compose"
cd "$PARENT/libra-backend"
[ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }
docker compose up -d
echo "    waiting for Postgres to accept connections..."
for i in $(seq 1 40); do
  if docker compose exec -T postgres pg_isready -U libra >/dev/null 2>&1; then
    echo "    Postgres is ready."
    break
  fi
  sleep 2
done

echo "==> 4/7 Backend: gradle wrapper"
cd "$PARENT/libra-backend"
if [ ! -f gradlew ]; then
  gradle wrapper --gradle-version 8.14.3
fi

echo "==> 5/7 Agent: uv sync + .env"
cd "$PARENT/libra-agent"
[ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }
if [ -n "${ANTHROPIC_API_KEY:-}" ] && [ -f .env ]; then
  if grep -q "^ANTHROPIC_API_KEY=" .env; then
    sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}|" .env
  else
    printf '\nANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" >> .env
  fi
else
  echo "    WARN: ANTHROPIC_API_KEY not set as Codespace secret — agent will start but Claude calls will fail."
  echo "          Set it at https://github.com/settings/codespaces (Secrets) and restart this codespace."
fi
uv sync || true

echo "==> 6/7 Ingest: uv sync (optional, for sample data)"
cd "$PARENT/libra-ingest"
uv sync || true

echo "==> 7/7 Frontend: npm ci + relative API base URL"
cd "$WORKSPACE"
[ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }
# Codespace: keep browser on origin :5173, let Vite proxy /api to :8080
if grep -q "^VITE_API_BASE_URL=" .env; then
  sed -i 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=/|' .env
else
  echo "VITE_API_BASE_URL=/" >> .env
fi
if grep -q "^VITE_METRICS_USE_MOCK=" .env; then
  sed -i 's|^VITE_METRICS_USE_MOCK=.*|VITE_METRICS_USE_MOCK=false|' .env
else
  echo "VITE_METRICS_USE_MOCK=false" >> .env
fi
npm ci

cat <<EOF

═══════════════════════════════════════════════════════════
 ✅ Libra Codespace ready

 Run services in three terminals (or use VS Code "Run Task"):

   ① Agent
      cd $PARENT/libra-agent
      uv run uvicorn libra_agent.main:app --host 0.0.0.0 --port 8000 --reload

   ② Backend
      cd $PARENT/libra-backend
      ./gradlew bootRun

   ③ Frontend
      cd $WORKSPACE
      npm run dev -- --host 0.0.0.0

 Or:  VS Code menu → Terminal → Run Task → "Libra: Run All"

 Then click the Ports tab and open the 5173 preview URL.

 Demo login (auto-seeded by backend on dev profile):
   email:    demo@libra.local
   password: demo1234
═══════════════════════════════════════════════════════════
EOF
