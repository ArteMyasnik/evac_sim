# evac-sim

Система моделирования эвакуации из SVG-планов зданий.

## Стек

- **Backend:** Java 21, Javalin, SQLite, HikariCP, Flyway, BCrypt
- **Frontend:** TypeScript, Vite
- **Инфраструктура:** Docker, Docker Compose

## Структура

- `server/` — бэкенд (Javalin)
- `web/` — фронтенд (TypeScript + Vite)
- `server/src/main/java/.../parser/` — место под парсер SVG (не наш)
- `server/src/main/java/.../simulation/` — место под симуляцию (не наш)

## Запуск

```bash
docker compose up --build