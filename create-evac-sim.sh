#!/usr/bin/env bash
#
# create-evac-sim.sh — создаёт полную структуру проекта evac-sim
# относительно текущей директории.
#
# Использование:
#   chmod +x create-evac-sim.sh
#   ./create-evac-sim.sh
#
set -euo pipefail

ROOT="$(pwd)/evac-sim"

# --- проверка, что не перезапишем существующее ---
if [ -e "$ROOT" ]; then
    echo "Ошибка: $ROOT уже существует. Удалите его или запустите скрипт в другой директории." >&2
    exit 1
fi

echo "Создаю структуру в: $ROOT"

# --- вспомогательные функции ---
mkfile() {  # mkfile <path>  — создаёт пустой файл, создавая родительские директории
    mkdir -p "$(dirname "$1")"
    : > "$1"
}
mkdirp() { mkdir -p "$1"; }

# ============================================================
# Корень проекта
# ============================================================
mkdirp "$ROOT"

mkfile "$ROOT/pom.xml"
mkfile "$ROOT/Dockerfile"
mkfile "$ROOT/docker-compose.yml"
mkfile "$ROOT/.env.example"
mkfile "$ROOT/.gitignore"
mkfile "$ROOT/.dockerignore"
mkfile "$ROOT/README.md"

# ============================================================
# server/
# ============================================================
SERVER="$ROOT/server"
JAVA_BASE="$SERVER/src/main/java/com/artemyasnik/evac/server"
RES_BASE="$SERVER/src/main/resources"
TEST_BASE="$SERVER/src/test/java/com/artemyasnik/evac/server"

mkfile "$SERVER/pom.xml"

# --- main/java/com/artemyasnik/evac/server ---
mkfile "$JAVA_BASE/ServerApp.java"

# config/
mkfile "$JAVA_BASE/config/Config.java"
mkfile "$JAVA_BASE/config/Database.java"
mkfile "$JAVA_BASE/config/Migrations.java"

# auth/
mkfile "$JAVA_BASE/auth/AuthController.java"
mkfile "$JAVA_BASE/auth/AuthService.java"
mkfile "$JAVA_BASE/auth/AuthMiddleware.java"
mkfile "$JAVA_BASE/auth/SessionRepository.java"
mkfile "$JAVA_BASE/auth/UserRepository.java"

# building/
mkfile "$JAVA_BASE/building/BuildingController.java"
mkfile "$JAVA_BASE/building/BuildingService.java"
mkfile "$JAVA_BASE/building/BuildingRepository.java"
mkfile "$JAVA_BASE/building/FloorRepository.java"
mkfile "$JAVA_BASE/building/ScenarioRepository.java"
mkfile "$JAVA_BASE/building/MarkRepository.java"

# dto/
mkfile "$JAVA_BASE/dto/BuildingSummaryDto.java"
mkfile "$JAVA_BASE/dto/BuildingDto.java"
mkfile "$JAVA_BASE/dto/FloorDto.java"
mkfile "$JAVA_BASE/dto/ScenarioSummaryDto.java"
mkfile "$JAVA_BASE/dto/ScenarioDto.java"
mkfile "$JAVA_BASE/dto/MarkDto.java"
mkfile "$JAVA_BASE/dto/ParamsDto.java"
mkfile "$JAVA_BASE/dto/FireDto.java"
mkfile "$JAVA_BASE/dto/LoginRequest.java"
mkfile "$JAVA_BASE/dto/RegisterRequest.java"
mkfile "$JAVA_BASE/dto/UserDto.java"
mkfile "$JAVA_BASE/dto/ErrorDto.java"

# web/
mkfile "$JAVA_BASE/web/StaticFiles.java"
mkfile "$JAVA_BASE/web/GlobalExceptionHandler.java"

# parser/
mkfile "$JAVA_BASE/parser/package-info.java"
mkfile "$JAVA_BASE/parser/SvgParser.java"

# simulation/
mkfile "$JAVA_BASE/simulation/package-info.java"
mkfile "$JAVA_BASE/simulation/EvacuationSimulator.java"
mkfile "$JAVA_BASE/simulation/SimulationResult.java"

# --- main/resources ---
mkfile "$RES_BASE/logback.xml"
mkfile "$RES_BASE/application.properties"
mkfile "$RES_BASE/db/migration/V1__init.sql"

# --- test/java/com/artemyasnik/evac/server ---
mkfile "$TEST_BASE/TestServer.java"
mkfile "$TEST_BASE/auth/AuthIntegrationTest.java"
mkfile "$TEST_BASE/building/BuildingIntegrationTest.java"
mkfile "$TEST_BASE/building/FloorIntegrationTest.java"
mkfile "$TEST_BASE/building/ScenarioIntegrationTest.java"
mkfile "$TEST_BASE/building/MarkIntegrationTest.java"
mkfile "$TEST_BASE/web/HealthTest.java"

# ============================================================
# web/
# ============================================================
WEB="$ROOT/web"
SRC="$WEB/src"

mkfile "$WEB/package.json"
mkfile "$WEB/package-lock.json"    # будет перегенерирован npm install
mkfile "$WEB/tsconfig.json"
mkfile "$WEB/vite.config.ts"
mkfile "$WEB/.eslintrc.json"
mkfile "$WEB/index.html"
mkfile "$WEB/login.html"
mkfile "$WEB/buildings.html"
mkfile "$WEB/building.html"
mkfile "$WEB/scenario.html"
mkfile "$WEB/viewer.html"

# public/.gitkeep  — сохраняем пустую директорию public/
mkdirp "$WEB/public"
mkfile "$WEB/public/.gitkeep"

# src/
mkfile "$SRC/types.ts"
mkfile "$SRC/api.ts"
mkfile "$SRC/auth.ts"
mkfile "$SRC/store.ts"
mkfile "$SRC/shared.ts"

mkfile "$SRC/ui/login.ts"
mkfile "$SRC/ui/buildings.ts"
mkfile "$SRC/ui/building.ts"
mkfile "$SRC/ui/scenario.ts"
mkfile "$SRC/ui/viewer.ts"

mkfile "$SRC/render/plan.ts"
mkfile "$SRC/render/marks.ts"

mkfile "$SRC/simulation/grid.ts"
mkfile "$SRC/simulation/engine.ts"
mkfile "$SRC/simulation/field.ts"

mkfile "$SRC/styles/shared.css"

# ============================================================
echo "Готово. Структура создана в: $ROOT"
