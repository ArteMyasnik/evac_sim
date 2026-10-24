// web/src/simulation/grid.ts
import type { Grid } from './field';

const CELL_M = 0.4; // Стандартная ячейка

export function buildGrid(svgText: string, vb: [number, number, number, number], scale: number): Promise<Grid> {
    return new Promise((resolve, reject) => {
        const cu = CELL_M * scale;
        const [vx, vy, w, h] = vb;
        const gw = Math.max(1, Math.ceil(w / cu));
        const gh = Math.max(1, Math.ceil(h / cu));
        const S = 3;

        if (gw * gh > 90000) {
            return reject(new Error(`Сетка слишком мелкая. Проверьте масштаб.`));
        }

        const parser = new DOMParser();
        const el = parser.parseFromString(svgText, 'image/svg+xml').documentElement;
        el.setAttribute('width', String(w));
        el.setAttribute('height', String(h));

        const img = new Image();
        img.onload = () => {
            const cv = document.createElement('canvas');
            const W = (cv.width = gw * S);
            const H = (cv.height = gh * S);
            const c = cv.getContext('2d', { willReadFrequently: true })!;

            c.fillStyle = '#fff';
            c.fillRect(0, 0, W, H);
            c.drawImage(img, 0, 0, W, H);

            const d = c.getImageData(0, 0, W, H).data;
            const wall = new Uint8Array(gw * gh);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const i = (y * W + x) * 4;
                    // Порог яркости 150
                    if (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 150) {
                        wall[((y / S) | 0) * gw + ((x / S) | 0)] = 1;
                    }
                }
            }
            resolve({ gw, gh, cu, vx, vy, wall });
        };
        img.onerror = () => reject(new Error('Не удалось разобрать SVG как изображение.'));

        const serialized = new XMLSerializer().serializeToString(el);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
    });
}

export function snap(g: Grid, x: number, y: number): number {
    const cx = Math.floor((x - g.vx) / g.cu);
    const cy = Math.floor((y - g.vy) / g.cu);
    for (let r = 0; r <= 6; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const X = cx + dx, Y = cy + dy;
                if (X >= 0 && Y >= 0 && X < g.gw && Y < g.gh && !g.wall[Y * g.gw + X]) {
                    return Y * g.gw + X;
                }
            }
        }
    }
    return -1;
}

export function snapFree(g: Grid, occ: Uint8Array, x: number, y: number, maxR = 25): number {
    const cx = Math.floor((x - g.vx) / g.cu);
    const cy = Math.floor((y - g.vy) / g.cu);
    for (let r = 0; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const X = cx + dx, Y = cy + dy;
                if (X < 0 || Y < 0 || X >= g.gw || Y >= g.gh) continue;
                const idx = Y * g.gw + X;
                if (!g.wall[idx] && !occ[idx]) return idx;
            }
        }
    }
    return -1;
}