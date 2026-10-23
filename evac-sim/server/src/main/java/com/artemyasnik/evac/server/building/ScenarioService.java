package com.artemyasnik.evac.server.building;

import com.artemyasnik.evac.server.dto.FireDto;
import com.artemyasnik.evac.server.dto.ParamsDto;
import com.artemyasnik.evac.server.dto.ScenarioDto;
import com.artemyasnik.evac.server.dto.ScenarioFullDto;
import com.artemyasnik.evac.server.dto.ScenarioRequest;
import com.artemyasnik.evac.server.dto.ScenarioSummaryDto;

import java.util.ArrayList;
import java.util.List;

public final class ScenarioService {

    private final ScenarioRepository repo;
    private final BuildingRepository buildings;
    private final FloorRepository floors;
    private final MarkRepository marks;

    public ScenarioService(ScenarioRepository repo,
                           BuildingRepository buildings,
                           FloorRepository floors,
                           MarkRepository marks) {
        this.repo = repo;
        this.buildings = buildings;
        this.floors = floors;
        this.marks = marks;
    }

    public ScenarioSummaryDto create(long buildingId, long userId, ScenarioRequest req) {
        requireBuilding(buildingId, userId);

        String name = validateName(req.name());
        ParamsDto params = (req.params() == null ? ParamsDto.defaultParams() : req.params().withDefaults());
        FireDto fire = validateFire(req.fire(), buildingId);

        boolean isFirst = repo.findAllByBuilding(buildingId).isEmpty();
        long id = repo.create(buildingId, name, isFirst, params, fire);
        buildings.touchUpdatedAt(buildingId);

        ScenarioRepository.ScenarioRow row = repo.findByIdAndBuilding(id, buildingId)
                .orElseThrow(() -> new IllegalStateException("Только что созданный сценарий не найден"));
        return toSummary(row);
    }

    public List<ScenarioSummaryDto> list(long buildingId, long userId) {
        requireBuilding(buildingId, userId);
        List<ScenarioSummaryDto> out = new ArrayList<>();
        for (ScenarioRepository.ScenarioRow row : repo.findAllByBuilding(buildingId)) {
            out.add(toSummary(row));
        }
        return out;
    }

    public ScenarioFullDto get(long buildingId, long scenarioId, long userId) {
        requireBuilding(buildingId, userId);
        ScenarioRepository.ScenarioRow row = repo.findByIdAndBuilding(scenarioId, buildingId)
                .orElseThrow(() -> new NotFoundException("Сценарий не найден"));
        return toFullDto(row);
    }

    public ScenarioFullDto update(long buildingId, long scenarioId, long userId, ScenarioRequest req) {
        requireBuilding(buildingId, userId);

        String name = validateName(req.name());
        ParamsDto params = (req.params() == null ? ParamsDto.defaultParams() : req.params().withDefaults());
        FireDto fire = validateFire(req.fire(), buildingId);

        if (!repo.update(scenarioId, buildingId, name, params, fire)) {
            throw new NotFoundException("Сценарий не найден");
        }
        buildings.touchUpdatedAt(buildingId);

        ScenarioRepository.ScenarioRow row = repo.findByIdAndBuilding(scenarioId, buildingId)
                .orElseThrow(() -> new NotFoundException("Сценарий не найден"));
        return toFullDto(row);
    }

    public void delete(long buildingId, long scenarioId, long userId) {
        requireBuilding(buildingId, userId);

        List<ScenarioRepository.ScenarioRow> all = repo.findAllByBuilding(buildingId);
        ScenarioRepository.ScenarioRow target = all.stream()
                .filter(s -> s.id() == scenarioId)
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Сценарий не найден"));

        if (all.size() == 1) {
            throw new IllegalStateException("Нельзя удалить единственный сценарий здания");
        }

        if (!repo.delete(scenarioId, buildingId)) {
            throw new NotFoundException("Сценарий не найден");
        }

        if (target.isDefault()) {
            List<ScenarioRepository.ScenarioRow> remaining = repo.findAllByBuilding(buildingId);
            if (!remaining.isEmpty()) {
                repo.setDefault(remaining.get(0).id(), buildingId);
            }
        }
        buildings.touchUpdatedAt(buildingId);
    }

    public void setDefault(long buildingId, long scenarioId, long userId) {
        requireBuilding(buildingId, userId);
        repo.findByIdAndBuilding(scenarioId, buildingId)
                .orElseThrow(() -> new NotFoundException("Сценарий не найден"));
        repo.setDefault(scenarioId, buildingId);
        buildings.touchUpdatedAt(buildingId);
    }

    private void requireBuilding(long buildingId, long userId) {
        buildings.findByIdAndUser(buildingId, userId)
                .orElseThrow(() -> new NotFoundException("Здание не найдено"));
    }

    private FireDto validateFire(FireDto fire, long buildingId) {
        if (fire == null) {
            return null;
        }
        if (fire.floorId() == null) {
            throw new IllegalArgumentException("У очага пожара должен быть floorId");
        }
        if (fire.x() == null || fire.y() == null) {
            throw new IllegalArgumentException("У очага пожара должны быть координаты x и y");
        }
        floors.findByIdAndBuilding(fire.floorId(), buildingId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Этаж с id=" + fire.floorId() + " не найден в этом здании"));
        return fire;
    }

    private static String validateName(String name) {
        if (name == null) {
            throw new IllegalArgumentException("Название сценария обязательно");
        }
        String n = name.trim();
        if (n.isEmpty()) {
            throw new IllegalArgumentException("Название сценария не может быть пустым");
        }
        if (n.length() > 200) {
            throw new IllegalArgumentException("Название сценария длиннее 200 символов");
        }
        return n;
    }

    private static ScenarioSummaryDto toSummary(ScenarioRepository.ScenarioRow row) {
        return new ScenarioSummaryDto(
                row.id(),
                row.name(),
                row.isDefault(),
                row.createdAt(),
                row.updatedAt()
        );
    }

    private ScenarioFullDto toFullDto(ScenarioRepository.ScenarioRow row) {
        return new ScenarioFullDto(
                row.id(),
                row.name(),
                row.isDefault(),
                row.params(),
                row.fire(),
                marks.findAllByScenario(row.id()),
                row.createdAt(),
                row.updatedAt()
        );
    }
}