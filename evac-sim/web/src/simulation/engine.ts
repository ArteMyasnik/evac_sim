// web/src/simulation/engine.ts
import type { Grid } from './field';
import { fieldFrom } from './field';
import { buildGrid, snap } from './grid';
import type { SimulationBuilding } from '../store';

export interface Portal {
    kind: 'exit' | 'stair';
    gap: number;
    toFloor?: string;
    toIdx?: number;
    stairTime?: number;
    busyUntil?: number;
}

export interface Engine {
    grids: Record<string, Grid>;
    fields: Record<string, Float32Array>;
    portals: Record<string, Map<number, Portal>>;
}

export async function buildEngine(b: SimulationBuilding): Promise<Engine> {
    const fs = [...b.floors].sort((a, c) => a.level - c.level);
    const P = b.params;
    const grids: Record<string, Grid> = {};
    const fields: Record<string, Float32Array> = {};
    const portals: Record<string, Map<number, Portal>> = {};

    // 1. Строим сетки для всех этажей
    for (const fl of fs) {
        grids[fl.id] = await buildGrid(fl.svg, fl.vb, P.scale);
    }

    // 2. Строим поля (от выходов и лестниц) снизу вверх
    for (let i = 0; i < fs.length; i++) {
        const fl = fs[i];
        const g = grids[fl.id];
        const pm = new Map<number, Portal>();
        const sources: { idx: number; extra: number }[] = [];

        // Выходы на этом этаже
        b.exits.filter(e => e.floor === fl.id).forEach(e => {
            const idx = snap(g, e.x, e.y);
            if (idx < 0) return;
            pm.set(idx, { kind: 'exit', gap: 1 / Math.max(0.05, (e.w || 1) * P.exitFlow) });
            sources.push({ idx, extra: 0 });
        });

        // Лестницы с этого этажа на нижний (если есть нижний)
        if (i > 0) {
            const below = fs[i - 1];
            const gb = grids[below.id];
            const fb = fields[below.id];

            b.stairs.filter(s => s.floor === fl.id).forEach(s => {
                const idxB = snap(gb, s.x, s.y);
                const idx = snap(g, s.x, s.y);
                if (idx < 0 || idxB < 0 || !isFinite(fb[idxB])) return;

                pm.set(idx, {
                    kind: 'stair',
                    gap: 1 / Math.max(0.05, (s.w || 1) * P.stairFlow),
                    toFloor: below.id,
                    toIdx: idxB,
                    stairTime: P.stairTime
                });
                sources.push({ idx, extra: fb[idxB] + P.stairTime });
            });
        }

        portals[fl.id] = pm;
        fields[fl.id] = sources.length > 0
            ? fieldFrom(g, sources, P.speed)
            : new Float32Array(g.gw * g.gh).fill(Infinity);
    }

    return { grids, fields, portals };
}