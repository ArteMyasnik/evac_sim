# ─── Stage 1: сборка фронтенда ───────────────────────────
FROM node:20-alpine AS web-build
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ─── Stage 2: сборка бэкенда ─────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS server-build
WORKDIR /build
COPY pom.xml ./
COPY server/pom.xml server/
RUN mvn -B -pl server dependency:go-offline
COPY server/ server/
# Копируем собранные JS/CSS из первого этапа в статику сервера
COPY --from=web-build /web/public/ server/src/main/resources/static/
RUN mvn -B -pl server package -DskipTests

# ─── Stage 3: runtime ────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=server-build /build/server/target/server.jar app.jar
VOLUME /data
ENV DB_PATH=/data/evac.db
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]