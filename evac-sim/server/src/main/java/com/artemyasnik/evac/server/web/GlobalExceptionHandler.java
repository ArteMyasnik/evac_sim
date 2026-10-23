package com.artemyasnik.evac.server.web;

import com.artemyasnik.evac.server.building.NotFoundException;
import io.javalin.Javalin;
import io.javalin.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Глобальный обработчик исключений: превращает исключения в JSON-ответы.
 * <p>
 * Формат ошибки: {@code {"error": "...", "message": "..."}}.
 */
public final class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private GlobalExceptionHandler() {
    }

    public static void register(Javalin app) {
        app.exception(NotFoundException.class, (e, ctx) -> {
            log.debug("Not found: {}", e.getMessage());
            ctx.status(HttpStatus.NOT_FOUND);
            ctx.json(new ErrorBody("not_found", e.getMessage()));
        });

        app.exception(IllegalArgumentException.class, (e, ctx) -> {
            log.warn("Bad request: {}", e.getMessage());
            ctx.status(HttpStatus.BAD_REQUEST);
            ctx.json(new ErrorBody("bad_request", e.getMessage()));
        });

        app.exception(IllegalStateException.class, (e, ctx) -> {
            log.warn("Conflict: {}", e.getMessage());
            ctx.status(HttpStatus.CONFLICT);
            ctx.json(new ErrorBody("conflict", e.getMessage()));
        });

        app.exception(Exception.class, (e, ctx) -> {
            log.error("Unhandled exception", e);
            ctx.status(HttpStatus.INTERNAL_SERVER_ERROR);
            ctx.json(new ErrorBody("internal_error", "Внутренняя ошибка сервера"));
        });
    }

    public record ErrorBody(String error, String message) {
    }
}