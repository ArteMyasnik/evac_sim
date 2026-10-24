import type { Building, ScenarioFull, Floor } from './types';

/**
 * Формат, который ожидает старый `buildEngine` в shared.js.
 */
export interface SimulationBuilding {
    floors: {
        id: string;
        name: string;
        level: number;
        svg: string;
        vb: [number, number, number, number];
    }[];
    stairs: { floor: string; x: number; y: number; w: number }[];
    exits:  { floor: string; x: number; y: number; w: number }[];
    spawns: { floor: string; x: number; y: number }[];
    fire:   { floor: string; x: number; y: number } | null;
    params: {
        people: number; speed: number; fireRate: number; scale: number;
        stairTime: number; exitFlow: number; stairFlow: number;
    };
}

export function toSimulationInput(building: Building, scenario: ScenarioFull): SimulationBuilding {
    const floors = building.floors.map((f: Floor) => ({
        id: String(f.id),
        name: f.name,
        level: f.level,
        svg: f.svg,
        vb: f.vb
    }));

    const stairs = scenario.marks
        .filter(m => m.kind === 'stair')
        .map(m => ({ floor: String(m.floorId), x: m.x, y: m.y, w: m.width ?? 1 }));

    const exits = scenario.marks
        .filter(m => m.kind === 'exit')
        .map(m => ({ floor: String(m.floorId), x: m.x, y: m.y, w: m.width ?? 1 }));

    const spawns = scenario.marks
        .filter(m => m.kind === 'spawn')
        .map(m => ({ floor: String(m.floorId), x: m.x, y: m.y }));

    const fire = scenario.fire
        ? { floor: String(scenario.fire.floorId), x: scenario.fire.x, y: scenario.fire.y }
        : null;

    return {
        floors,
        stairs,
        exits,
        spawns,
        fire,
        params: scenario.params
    };
}