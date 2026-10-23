package com.artemyasnik.evac.server;

import com.artemyasnik.evac.server.auth.AuthController;
import com.artemyasnik.evac.server.auth.AuthService;
import com.artemyasnik.evac.server.auth.SessionRepository;
import com.artemyasnik.evac.server.auth.UserRepository;
import com.artemyasnik.evac.server.building.BuildingController;
import com.artemyasnik.evac.server.building.BuildingRepository;
import com.artemyasnik.evac.server.building.BuildingService;
import com.artemyasnik.evac.server.building.FloorController;
import com.artemyasnik.evac.server.building.FloorRepository;
import com.artemyasnik.evac.server.building.FloorService;
import com.artemyasnik.evac.server.building.MarkController;
import com.artemyasnik.evac.server.building.MarkRepository;
import com.artemyasnik.evac.server.building.MarkService;
import com.artemyasnik.evac.server.building.ScenarioController;
import com.artemyasnik.evac.server.building.ScenarioRepository;
import com.artemyasnik.evac.server.building.ScenarioService;
import com.artemyasnik.evac.server.config.Config;
import com.artemyasnik.evac.server.config.Database;
import com.artemyasnik.evac.server.config.Migrations;
import com.artemyasnik.evac.server.web.GlobalExceptionHandler;
import com.artemyasnik.evac.server.web.StaticFiles;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.json.JavalinJackson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class ServerApp {

    private static final Logger log = LoggerFactory.getLogger(ServerApp.class);

    private ServerApp() {
    }

    public static void main(String[] args) {
        Config config = Config.fromEnv();
        log.info("Запуск evac-sim server на порту {} (DB: {})", config.port(), config.dbPath());

        // 1. БД + миграции.
        Database db = new Database(config.dbPath());
        try {
            Migrations.run(db.getDataSource());
        } catch (RuntimeException e) {
            log.error("Не удалось применить миграции — сервер не стартует", e);
            db.close();
            return;
        }

        // 2. ObjectMapper для JSON-колонок.
        ObjectMapper mapper = new ObjectMapper();

        // 3. Репозитории.
        UserRepository users = new UserRepository(db);
        SessionRepository sessions = new SessionRepository(db);
        BuildingRepository buildings = new BuildingRepository(db);
        FloorRepository floors = new FloorRepository(db);
        ScenarioRepository scenarios = new ScenarioRepository(db, mapper);
        MarkRepository marks = new MarkRepository(db);

        // 4. Сервисы.
        AuthService auth = new AuthService(users, sessions, config.sessionTtlHours());
        BuildingService buildingService = new BuildingService(buildings, floors, scenarios);
        FloorService floorService = new FloorService(floors, buildings);
        ScenarioService scenarioService = new ScenarioService(scenarios, buildings, floors, marks);
        MarkService markService = new MarkService(marks, scenarios, floors);

        // 5. Контроллеры.
        AuthController authCtrl = new AuthController(auth, config.sessionTtlHours());
        BuildingController buildingCtrl = new BuildingController(buildingService);
        FloorController floorCtrl = new FloorController(floorService);
        ScenarioController scenarioCtrl = new ScenarioController(scenarioService);
        MarkController markCtrl = new MarkController(markService);

        // 6. Первый пользователь.
        seedAdminIfEmpty(users, config);

        // 7. Клинап сессий.
        ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "session-cleaner");
            t.setDaemon(true);
            return t;
        });
        cleaner.scheduleAtFixedRate(() -> {
            try {
                auth.cleanupExpiredSessions();
            } catch (Exception e) {
                log.warn("Ошибка клинапа сессий: {}", e.getMessage());
            }
        }, 1, 1, TimeUnit.HOURS);

        // 8. Javalin.
        Javalin app = Javalin.create(cfg -> {
            cfg.showJavalinBanner = false;
            cfg.jsonMapper(new JavalinJackson());

            cfg.bundledPlugins.enableCors(cors -> {
                cors.addRule(rule -> {
                    rule.allowHost("http://localhost:5173");
                    rule.allowCredentials = true;
                });
            });

            StaticFiles.register(cfg);
        });

        GlobalExceptionHandler.register(app);

        // 9. Middleware.
        app.before("/api/*", authCtrl::attachUser);
        app.before("/api/buildings", authCtrl::requireAuth);
        app.before("/api/buildings/*", authCtrl::requireAuth);

        registerApiRoutes(app, db, authCtrl, buildingCtrl, floorCtrl, scenarioCtrl, markCtrl);

        // 10. Graceful shutdown.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            log.info("Остановка сервера...");
            cleaner.shutdownNow();
            app.stop();
            db.close();
        }, "shutdown-hook"));

        // 11. Start.
        app.start(config.port());
        log.info("Сервер запущен: http://localhost:{}", config.port());
    }

    private static void seedAdminIfEmpty(UserRepository users, Config config) {
        if (users.countAll() > 0) {
            return;
        }
        try {
            String hash = org.mindrot.jbcrypt.BCrypt.hashpw(config.adminPassword(),
                    org.mindrot.jbcrypt.BCrypt.gensalt(10));
            long id = users.create(config.adminUsername(), hash);
            log.info("Создан первый пользователь из env: id={}, username='{}'", id, config.adminUsername());
        } catch (Exception e) {
            log.error("Не удалось создать первого пользователя: {}", e.getMessage());
        }
    }

    private static void registerApiRoutes(
            Javalin app,
            Database db,
            AuthController authCtrl,
            BuildingController buildingCtrl,
            FloorController floorCtrl,
            ScenarioController scenarioCtrl,
            MarkController markCtrl
    ) {
        // ---- Auth ----
        app.post("/api/auth/register", authCtrl::register);
        app.post("/api/auth/login", authCtrl::login);
        app.post("/api/auth/logout", authCtrl::logout);
        app.get("/api/auth/me", authCtrl::me);

        // ---- Buildings ----
        app.get("/api/buildings", buildingCtrl::list);
        app.post("/api/buildings", buildingCtrl::create);
        app.get("/api/buildings/{id}", buildingCtrl::get);
        app.put("/api/buildings/{id}", buildingCtrl::update);
        app.delete("/api/buildings/{id}", buildingCtrl::delete);

        // ---- Floors ----
        app.get("/api/buildings/{bid}/floors", floorCtrl::list);
        app.post("/api/buildings/{bid}/floors", floorCtrl::create);
        app.get("/api/buildings/{bid}/floors/{fid}", floorCtrl::get);
        app.get("/api/buildings/{bid}/floors/{fid}/svg", floorCtrl::getSvg);
        app.put("/api/buildings/{bid}/floors/{fid}", floorCtrl::update);
        app.delete("/api/buildings/{bid}/floors/{fid}", floorCtrl::delete);

        // ---- Scenarios ----
        app.get("/api/buildings/{bid}/scenarios", scenarioCtrl::list);
        app.post("/api/buildings/{bid}/scenarios", scenarioCtrl::create);
        app.get("/api/buildings/{bid}/scenarios/{sid}", scenarioCtrl::get);
        app.put("/api/buildings/{bid}/scenarios/{sid}", scenarioCtrl::update);
        app.delete("/api/buildings/{bid}/scenarios/{sid}", scenarioCtrl::delete);
        app.post("/api/buildings/{bid}/scenarios/{sid}/default", scenarioCtrl::setDefault);

        // ---- Marks ----
        app.get("/api/buildings/{bid}/scenarios/{sid}/marks", markCtrl::list);
        app.post("/api/buildings/{bid}/scenarios/{sid}/marks", markCtrl::create);
        app.put("/api/buildings/{bid}/scenarios/{sid}/marks/{mid}", markCtrl::update);
        app.delete("/api/buildings/{bid}/scenarios/{sid}/marks/{mid}", markCtrl::delete);
        app.delete("/api/buildings/{bid}/scenarios/{sid}/marks", markCtrl::deleteAll);

        // ---- Health ----
        app.get("/api/health", ctx ->
                ctx.json(Map.of(
                        "status", "ok",
                        "service", "evac-sim-server",
                        "version", "0.1.0"
                )));

        app.get("/api/health/db", ctx -> {
            Map<String, Object> body = new LinkedHashMap<>();
            boolean alive = db.ping();
            int tables = alive ? db.countUserTables() : -1;
            body.put("database", alive ? "ok" : "down");
            body.put("tables", tables);
            ctx.status(alive ? 200 : 503);
            ctx.json(body);
        });

        // ---- Root ----
        app.get("/", ctx -> {
            try (var is = ServerApp.class.getResourceAsStream("/static/index.html")) {
                if (is != null) {
                    ctx.contentType("text/html; charset=utf-8");
                    ctx.result(is.readAllBytes());
                    return;
                }
            }
            ctx.contentType("text/html; charset=utf-8");
            ctx.result("""
                    <!doctype html>
                    <html lang="ru">
                    <head><meta charset="utf-8"><title>Evac Sim</title></head>
                    <body>
                      <h1>Evac Sim</h1>
                      <p>Сервер работает.</p>
                      <p><a href="/api/health">/api/health</a> ·
                         <a href="/api/health/db">/api/health/db</a> ·
                         <a href="/api/auth/me">/api/auth/me</a></p>
                    </body>
                    </html>
                    """);
        });
    }
}