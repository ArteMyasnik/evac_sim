export interface User {
    id: number;
    username: string;
}

export interface BuildingSummary {
    id: number;
    name: string;
    description: string;
    floorCount: number;
    scenarioCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface Floor {
    id: number;
    name: string;
    level: number;
    svg: string;
    vb: [number, number, number, number];
}

export interface ScenarioSummary {
    id: number;
    name: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Params {
    people: number;
    speed: number;
    fireRate: number;
    scale: number;
    stairTime: number;
    exitFlow: number;
    stairFlow: number;
}

export interface Fire {
    floorId: number;
    x: number;
    y: number;
}

export interface Mark {
    id: number;
    floorId: number;
    kind: 'stair' | 'exit' | 'spawn';
    x: number;
    y: number;
    width: number | null;
}

export interface Building {
    id: number;
    name: string;
    description: string;
    floors: Floor[];
    scenarios: ScenarioSummary[];
    createdAt: string;
    updatedAt: string;
}

export interface ScenarioFull {
    id: number;
    name: string;
    isDefault: boolean;
    params: Params;
    fire: Fire | null;
    marks: Mark[];
    createdAt: string;
    updatedAt: string;
}

export interface ErrorResponse {
    error: string;
    message: string;
}