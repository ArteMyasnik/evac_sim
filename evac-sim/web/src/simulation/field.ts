// web/src/simulation/field.ts

export interface Grid {
    gw: number;
    gh: number;
    cu: number;
    vx: number;
    vy: number;
    wall: Uint8Array;
}

export function heapPush(h: [number, number][], c: number, k: number) {
    h.push([c, k]);
    for (let i = h.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (h[p][0] <= h[i][0]) break;
        [h[p], h[i]] = [h[i], h[p]];
        i = p;
    }
}

export function heapPop(h: [number, number][]): [number, number] {
    const top = h[0], l = h.pop()!;
    if (h.length) {
        h[0] = l;
        for (let i = 0;;) {
            const a = 2 * i + 1, c = a + 1;
            let m = i;
            if (a < h.length && h[a][0] < h[m][0]) m = a;
            if (c < h.length && h[c][0] < h[m][0]) m = c;
            if (m === i) break;
            [h[m], h[i]] = [h[i], h[m]];
            i = m;
        }
    }
    return top;
}

export interface Source {
    idx: number;
    extra: number;
}

export function fieldFrom(g: Grid, sources: Source[], speed: number): Float32Array {
    const n = g.gw * g.gh;
    const dist = new Float32Array(n).fill(Infinity);
    const seen = new Uint8Array(n);
    const heap: [number, number][] = [];
    const diag = g.cu * Math.SQRT2;

    sources.forEach(s => {
        if (s.idx >= 0 && s.extra < dist[s.idx]) {
            dist[s.idx] = s.extra;
            heapPush(heap, s.extra, s.idx);
        }
    });

    while (heap.length) {
        const [d, idx] = heapPop(heap);
        if (seen[idx]) continue;
        seen[idx] = 1;
        const x = idx % g.gw;
        const y = (idx / g.gw) | 0;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= g.gw || ny >= g.gh) continue;
                const nidx = ny * g.gw + nx;
                if (g.wall[nidx]) continue;
                // Не срезать углы
                if (dx && dy && (g.wall[y * g.gw + nx] || g.wall[ny * g.gw + x])) continue;

                const nd = d + (dx && dy ? diag : g.cu) / speed;
                if (nd < dist[nidx]) {
                    dist[nidx] = nd;
                    heapPush(heap, nd, nidx);
                }
            }
        }
    }
    return dist;
}