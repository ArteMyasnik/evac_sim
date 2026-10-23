package com.artemyasnik.evac.server.config;

import java.nio.file.Path;

/**
 * Конфигурация сервера. Читается из переменных окружения один раз при старте.
 * <p>
 * Значения по умолчанию рассчитаны на dev-режим (локальный запуск без Docker).
 */
public record Config(
        int port,
        Path dbPath,
        String adminUsername,
        String adminPassword,
        long sessionTtlHours
) {

    public static Config fromEnv() {
        int port = parseInt(System.getenv("PORT"), 8080);
        String dbPathStr = getenv("DB_PATH", "./data/evac.db");
        String adminUsername = getenv("ADMIN_USERNAME", "admin");
        String adminPassword = getenv("ADMIN_PASSWORD", "admin");
        long sessionTtlHours = parseLong(System.getenv("SESSION_TTL_HOURS"), 168);

        return new Config(port, Path.of(dbPathStr), adminUsername, adminPassword, sessionTtlHours);
    }

    private static String getenv(String key, String def) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? def : v;
    }

    private static int parseInt(String s, int def) {
        if (s == null || s.isBlank()) return def;
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static long parseLong(String s, long def) {
        if (s == null || s.isBlank()) return def;
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }
}