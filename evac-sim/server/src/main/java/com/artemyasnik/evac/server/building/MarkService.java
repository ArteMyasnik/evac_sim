package com.artemyasnik.evac.server.building;

import com.artemyasnik.evac.server.dto.MarkDto;
import com.artemyasnik.evac.server.dto.MarkRequest;

import java.util.List;

public final class MarkService {

    private final MarkRepository marks;
    private final ScenarioRepository scenarios;
    private final FloorRepository floors;
    private final BuildingRepository buildings; // ДОБАВЛЕНО

    public MarkService(MarkRepository marks,
                       ScenarioRepository scenarios,
                       FloorRepository floors,
                       BuildingRepository buildings) { // ДОБАВЛЕНО
        this.marks = marks;
        this.scenarios = scenarios;
        this.floors = floors;
        this.buildings = buildings;
    }

    public List<MarkDto> list(long buildingId, long scenarioId, long userId) {
        requireOwnership(buildingId, scenarioId, userId);
        return marks.findAllByScenario(scenarioId);
    }

    public MarkDto create(long buildingId, long scenarioId, long userId, MarkRequest req) {
        requireOwnership(buildingId, scenarioId, userId);
        validate(req, buildingId);
        long id = marks.create(scenarioId, req);
        return marks.findByIdAndScenario(id, scenarioId)
                .orElseThrow(() -> new IllegalStateException("Только что созданная метка не найдена"));
    }

    public MarkDto update(long buildingId, long scenarioId, long markId, long userId, MarkRequest req) {
        requireOwnership(buildingId, scenarioId, userId);
        validate(req, buildingId);
        if (!marks.update(markId, scenarioId, req)) {
            throw new NotFoundException("Метка не найдена");
        }
        return marks.findByIdAndScenario(markId, scenarioId)
                .orElseThrow(() -> new NotFoundException("Метка не найдена"));
    }

    public void delete(long buildingId, long scenarioId, long markId, long userId) {
        requireOwnership(buildingId, scenarioId, userId);
        if (!marks.delete(markId, scenarioId)) {
            throw new NotFoundException("Метка не найдена");
        }
    }

    public void deleteAll(long buildingId, long scenarioId, long userId) {
        requireOwnership(buildingId, scenarioId, userId);
        marks.deleteAllByScenario(scenarioId);
    }

    // ИСПРАВЛЕНО: полная проверка владения
    private void requireOwnership(long buildingId, long scenarioId, long userId) {
        // 1. Проверяем, что здание принадлежит пользователю
        buildings.findByIdAndUser(buildingId, userId)
                .orElseThrow(() -> new NotFoundException("Здание не найдено"));
        // 2. Проверяем, что сценарий принадлежит этому зданию
        scenarios.findByIdAndBuilding(scenarioId, buildingId)
                .orElseThrow(() -> new NotFoundException("Сценарий не найден"));
    }

    private void validate(MarkRequest req, long buildingId) {
        if (req == null) {
            throw new IllegalArgumentException("Тело запроса обязательно");
        }
        if (req.kind() == null) {
            throw new IllegalArgumentException("kind обязателен (stair|exit|spawn)");
        }
        String k = req.kind();
        if (!k.equals("stair") && !k.equals("exit") && !k.equals("spawn")) {
            throw new IllegalArgumentException("kind должен быть stair, exit или spawn");
        }
        if (req.floorId() == null) {
            throw new IllegalArgumentException("floorId обязателен");
        }
        floors.findByIdAndBuilding(req.floorId(), buildingId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Этаж с id=" + req.floorId() + " не найден в этом здании"));
        if (req.x() == null || req.y() == null) {
            throw new IllegalArgumentException("Координаты x и y обязательны");
        }
        if ((k.equals("stair") || k.equals("exit")) &&
                (req.width() == null || req.width() <= 0)) {
            throw new IllegalArgumentException(
                    "Ширина (width) обязательна для stair и exit и должна быть > 0");
        }
        if (k.equals("spawn") && req.width() != null) {
            throw new IllegalArgumentException("Ширина (width) недопустима для spawn");
        }
    }
}