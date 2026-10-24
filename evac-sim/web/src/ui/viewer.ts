import { Auth } from '../auth';
import { api } from '../api';
import { $ } from '../shared';
import { toSimulationInput } from '../store';
import { buildEngine, type Engine } from '../simulation/engine';
import type { SimulationBuilding } from '../store';

Auth.requireAuth().then(() => Auth.renderHeader('Симуляция эвакуации'));

// ==================== Состояние ====================

interface Person {
    floor: string;
    idx: number;
    state: 'go' | 'stairs' | 'stuck' | 'out' | 'dead';
    freeAt: number;
    speed: number;
    toFloor?: string;
    toIdx?: number;
    tOut?: number;
}

let b: SimulationBuilding | null = null;
let ENGINE: Engine | null = null;
let occ: Record<string, Uint8Array> = {};
let people: Person[] = [];
let cur: string = '';
let t = 0;
let run = false;
let last = 0;

const urlParams = new URLSearchParams(window.location.search);
let BID = Number(urlParams.get('bid')) || 0;
let SID = Number(urlParams.get('sid')) || 0;

const planContainer = $('#plan-container') as HTMLDivElement;
const msgEl = $('#msg') as HTMLParagraphElement;
const goBtn = $('#go-btn') as HTMLButtonElement;
const floorTabsEl = $('#floor-tabs') as HTMLDivElement;

// ==================== Загрузка сценария ====================

async function initSelectors() {
    try {
        const buildings = await api.buildings.list();
        if (!buildings.length) {
            msgEl.textContent = 'У вас нет зданий.';
            goBtn.disabled = true;
            return;
        }
        BID = BID || buildings[0].id;
        const bData = await api.buildings.get(BID);
        if (!bData.scenarios.length) {
            msgEl.textContent = 'В здании нет сценариев.';
            goBtn.disabled = true;
            return;
        }
        SID = SID || (bData.scenarios.find(s => s.isDefault)?.id ?? bData.scenarios[0].id);
        const sel = $('#scenario-select') as HTMLSelectElement;
        sel.innerHTML = bData.scenarios
            .map(s => `<option value="${s.id}" ${s.id === SID ? 'selected' : ''}>${s.name}</option>`)
            .join('');
    } catch (e: any) {
        msgEl.textContent = e.message;
    }
}

async function loadScenario() {
    SID = Number(($('#scenario-select') as HTMLSelectElement).value);
    msgEl.textContent = 'Загрузка...';
    try {
        const bData = await api.buildings.get(BID);
        const sData = await api.scenarios.get(BID, SID);
        b = toSimulationInput(bData, sData);

        // Начинаем с самого нижнего этажа
        const sorted = [...b.floors].sort((a, c) => a.level - c.level);
        cur = sorted[0]?.id || '';

        msgEl.textContent = 'Расчёт проходимости и маршрутов...';
        ENGINE = await buildEngine(b);
        initOccupancy();
        resetPeople();
        renderFloorTabs();

        run = false;
        t = 0;
        goBtn.textContent = 'Запустить';
        goBtn.disabled = false;
        msgEl.textContent = 'Готово. Нажмите «Запустить».';
        draw();
    } catch (e: any) {
        msgEl.textContent = 'Ошибка: ' + e.message;
    }
}

// ==================== Люди ====================

function initOccupancy() {
    occ = {};
    b!.floors.forEach(f => {
        const g = ENGINE!.grids[f.id];
        occ[f.id] = new Uint8Array(g.gw * g.gh).fill(0);
    });
}

function resetPeople() {
    initOccupancy();
    people = [];
    if (!b || !ENGINE) return;

    const P = b.params;
    const sorted = [...b.floors].sort((a, c) => a.level - c.level);

    for (let k = 0; k < P.people; k++) {
        const sp = b.spawns.length ? b.spawns[k % b.spawns.length] : null;
        const fl = sp
            ? sorted.find(f => f.id === sp.floor)
            : sorted[Math.floor(Math.random() * sorted.length)];
        if (!fl) continue;

        const g = ENGINE.grids[fl.id];
        const px = sp ? sp.x + (Math.random() - 0.5) * g.cu * 3 : g.vx + Math.random() * g.gw * g.cu;
        const py = sp ? sp.y + (Math.random() - 0.5) * g.cu * 3 : g.vy + Math.random() * g.gh * g.cu;

        const idx = snapFree(g, occ[fl.id], px, py);
        if (idx < 0) continue;
        occ[fl.id][idx] = 1;

        const field = ENGINE.fields[fl.id][idx];
        people.push({
            floor: fl.id,
            idx,
            state: isFinite(field) ? 'go' : 'stuck',
            freeAt: 0,
            speed: P.speed * (0.85 + Math.random() * 0.3)
        });
    }
}

// Копия snapFree из grid.ts (упрощённая, только для внутреннего использования)
function snapFree(g: { gw: number; gh: number; cu: number; vx: number; vy: number; wall: Uint8Array },
                  occ: Uint8Array, x: number, y: number, maxR = 25): number {
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

// ==================== Шаг ====================

function moveOneStep(p: Person) {
    const g = ENGINE!.grids[p.floor];
    const field = ENGINE!.fields[p.floor];
    const occF = occ[p.floor];
    const cur0 = field[p.idx];
    if (!isFinite(cur0)) { occF[p.idx] = 0; p.state = 'stuck'; return; }

    const x = p.idx % g.gw, y = (p.idx / g.gw) | 0;
    let best = -1, bestVal = cur0 - 1e-6;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= g.gw || ny >= g.gh) continue;
            const nidx = ny * g.gw + nx;
            if (g.wall[nidx] || occF[nidx]) continue;
            if (dx && dy && (g.wall[y * g.gw + nx] || g.wall[ny * g.gw + x])) continue;
            const v = field[nidx];
            if (v < bestVal) { bestVal = v; best = nidx; }
        }
    }
    if (best < 0) return;

    const dx = (best % g.gw) - x;
    const dy = ((best / g.gw) | 0) - y;
    const travel = ((dx && dy) ? g.cu * Math.SQRT2 : g.cu) / p.speed;
    occF[p.idx] = 0;
    occF[best] = 1;
    p.idx = best;
    p.freeAt = t + travel;
}

function step(dt: number) {
    t += dt;
    const P = b!.params;
    const R = b!.fire ? P.fireRate * P.scale * t : 0;

    for (const p of people) {
        if (p.state === 'out' || p.state === 'dead' || p.state === 'stuck') continue;

        if (p.state === 'stairs') {
            if (t < p.freeAt) continue;
            if (occ[p.toFloor!][p.toIdx!]) continue;
            occ[p.toFloor!][p.toIdx!] = 1;
            p.floor = p.toFloor!;
            p.idx = p.toIdx!;
            p.state = 'go';
            p.freeAt = t;
            continue;
        }

        if (t < p.freeAt) continue;

        // Пожар
        if (b!.fire && p.floor === b!.fire.floor) {
            const g = ENGINE!.grids[p.floor];
            const x = g.vx + (p.idx % g.gw + 0.5) * g.cu;
            const y = g.vy + ((p.idx / g.gw | 0) + 0.5) * g.cu;
            if (Math.hypot(x - b!.fire.x, y - b!.fire.y) < R) {
                occ[p.floor][p.idx] = 0;
                p.state = 'dead';
                continue;
            }
        }

        // Портал (дверь/лестница)
        const portal = ENGINE!.portals[p.floor].get(p.idx);
        if (portal) {
            if (t < (portal.busyUntil || 0)) continue;
            portal.busyUntil = t + portal.gap;
            occ[p.floor][p.idx] = 0;
            if (portal.kind === 'exit') { p.state = 'out'; p.tOut = t; }
            else {
                p.state = 'stairs';
                p.toFloor = portal.toFloor!;
                p.toIdx = portal.toIdx!;
                p.freeAt = t + portal.stairTime!;
            }
            continue;
        }

        moveOneStep(p);
    }
}

// ==================== Отрисовка ====================

function renderFloorTabs() {
    floorTabsEl.innerHTML = '';
    if (!b) return;
    const sorted = [...b.floors].sort((a, c) => a.level - c.level);
    sorted.forEach(f => {
        const btn = document.createElement('button');
        btn.textContent = `${f.name} (${f.level})`;
        btn.className = f.id === cur ? 'on' : '';
        btn.onclick = () => { cur = f.id; renderFloorTabs(); draw(); };
        floorTabsEl.appendChild(btn);
    });
}

function draw() {
    if (!b || !ENGINE || !cur) return;
    const fl = b.floors.find(f => f.id === cur);
    if (!fl) return;
    const g = ENGINE.grids[fl.id];

    planContainer.innerHTML = '';
    const parser = new DOMParser();
    const svg = parser.parseFromString(fl.svg, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
    svg.setAttribute('viewBox', fl.vb.join(' '));
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.maxHeight = '80vh';

    const NS = 'http://www.w3.org/2000/svg';

    // --- 1. Очаг пожара (если на этом этаже) ---
    if (b.fire && b.fire.floor === fl.id) {
        const R = b.params.fireRate * b.params.scale * t;
        if (R > 0) {
            const fire = document.createElementNS(NS, 'circle');
            fire.setAttribute('cx', String(b.fire.x));
            fire.setAttribute('cy', String(b.fire.y));
            fire.setAttribute('r', String(R));
            fire.setAttribute('fill', '#d6361f');
            fire.setAttribute('fill-opacity', '0.22');
            fire.setAttribute('stroke', '#d6361f');
            svg.appendChild(fire);
        }
    }

    // --- 2. Метки (лестницы, выходы, спавны, очаг) ---
    const r = Math.max(fl.vb[2], fl.vb[3]) / 70;
    const colorMap: Record<string, string> = {
        stair: '#2d5fd0',
        exit: '#0e8f5b',
        spawn: '#b5730b',
        fire: '#d6361f',
    };
    const labelMap: Record<string, string> = {
        stair: 'Лестница',
        exit: 'Выход',
        spawn: 'Люди',
        fire: 'Очаг',
    };
    const drawMark = (x: number, y: number, kind: string, w?: number | null) => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(y));
        c.setAttribute('r', String(r));
        c.setAttribute('fill', colorMap[kind]);
        c.setAttribute('stroke', '#fff');
        c.setAttribute('stroke-width', String(r / 5));
        svg.appendChild(c);
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', String(x));
        text.setAttribute('y', String(y - r * 1.4));
        text.setAttribute('font-size', String(r * 1.6));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', colorMap[kind]);
        text.setAttribute('font-weight', '700');
        text.setAttribute('stroke', '#fff');
        text.setAttribute('stroke-width', String(r / 6));
        text.setAttribute('paint-order', 'stroke');
        text.textContent = labelMap[kind] + (w && (kind === 'stair' || kind === 'exit') ? ' ' + w + ' м' : '');
        svg.appendChild(text);
    };

    b.stairs.filter(m => m.floor === fl.id).forEach(m => drawMark(m.x, m.y, 'stair', m.w));
    b.exits.filter(m => m.floor === fl.id).forEach(m => drawMark(m.x, m.y, 'exit', m.w));
    b.spawns.filter(m => m.floor === fl.id).forEach(m => drawMark(m.x, m.y, 'spawn'));
    if (b.fire && b.fire.floor === fl.id) drawMark(b.fire.x, b.fire.y, 'fire');

    // --- 3. Люди ---
    const dot: Record<string, string> = { dead: '#000', stuck: '#b5730b', go: '#1c2a33' };
    people.forEach(p => {
        if (p.floor !== fl.id || p.state === 'out') return;
        const x = g.vx + (p.idx % g.gw + 0.5) * g.cu;
        const y = g.vy + ((p.idx / g.gw | 0) + 0.5) * g.cu;
        const waiting = p.state === 'go' && t < p.freeAt;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(y));
        c.setAttribute('r', String(r * 0.55));
        c.setAttribute('fill', waiting ? '#d0a300' : (dot[p.state] || '#000'));
        svg.appendChild(c);
    });

    planContainer.appendChild(svg);

    // --- 4. Статистика ---
    const c = (s: string) => people.filter(p => p.state === s).length;
    ($('#s-time') as HTMLElement).textContent = t.toFixed(0);
    ($('#s-out') as HTMLElement).textContent = String(c('out'));
    ($('#s-in') as HTMLElement).textContent = String(c('go') + c('stairs'));
    ($('#s-dead') as HTMLElement).textContent = String(c('dead'));
    ($('#s-stuck') as HTMLElement).textContent = String(c('stuck'));
}

// ==================== Цикл ====================

function frame(ts: number) {
    if (run && ENGINE) {
        const dt = Math.min((ts - last) / 1000, 0.1) * Number(($('#speed-select') as HTMLSelectElement).value);
        last = ts;
        step(dt);
        const active = people.some(p => p.state === 'go' || p.state === 'stairs');
        if (!active) { run = false; goBtn.textContent = 'Запустить'; }
    }
    if (b && cur) draw();
    requestAnimationFrame(frame);
}

// ==================== Кнопки ====================

$('#load-btn')!.addEventListener('click', loadScenario);

goBtn.addEventListener('click', () => {
    if (!b) return;
    if (!run) {
        const active = people.some(p => p.state === 'go' || p.state === 'stairs');
        if (!active) {
            resetPeople();
            t = 0;
        }
        run = true;
        goBtn.textContent = 'Пауза';
        last = performance.now();
    } else {
        run = false;
        goBtn.textContent = 'Запустить';
    }
});

$('#reset-btn')!.addEventListener('click', () => {
    run = false;
    t = 0;
    resetPeople();
    goBtn.textContent = 'Запустить';
    draw();
});

// ==================== Старт ====================

initSelectors();
requestAnimationFrame(frame);