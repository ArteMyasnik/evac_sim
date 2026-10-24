import { Auth } from '../auth';
import { api } from '../api';
import { $ } from '../shared';
import type { Building, ScenarioFull, Floor, Mark, Fire, Params } from '../types';

// 1. Получаем ID из URL
const urlParams = new URLSearchParams(window.location.search);
const BID = Number(urlParams.get('bid'));
const SID = Number(urlParams.get('sid'));

if (!BID || !SID) {
    alert('Не указан ID здания или сценария');
    location.href = '/buildings.html';
}

// 2. Состояние
let building: Building | null = null;
let scenario: ScenarioFull | null = null;
let currentFloorId: number | null = null;
let currentTool = 'stair';
let pendingMarks: Mark[] = []; // Локальная копия меток (чтобы не перезапрашивать сервер на каждый клик)

// DOM
const titleEl = $('#s-title') as HTMLSpanElement;
const buildingEl = $('#s-building') as HTMLParagraphElement;
const floorSelect = $('#floor-select') as HTMLSelectElement;
const planContainer = $('#plan-container') as HTMLDivElement;
const msgEl = $('#msg') as HTMLParagraphElement;
const widthInput = $('#tool-width') as HTMLInputElement;
const wrapW = $('#wrap-w') as HTMLLabelElement;

// Защита и шапка
Auth.requireAuth().then(() => {
    Auth.renderHeader('Настройка сценария');
    $('#back-link')!.setAttribute('href', `/building.html?id=${BID}`);
});

// 3. Загрузка
async function load() {
    try {
        building = await api.buildings.get(BID);
        scenario = await api.scenarios.get(BID, SID);
        pendingMarks = [...scenario.marks];

        titleEl.textContent = scenario.name;
        buildingEl.textContent = `Здание: ${building.name}`;

        // Заполняем селект этажей
        floorSelect.innerHTML = '';
        building.floors.sort((a, b) => a.level - b.level).forEach(f => {
            const opt = document.createElement('option');
            opt.value = String(f.id);
            opt.textContent = `${f.name} (уровень ${f.level})`;
            floorSelect.appendChild(opt);
        });

        if (building.floors.length > 0) {
            currentFloorId = building.floors[0].id;
            floorSelect.value = String(currentFloorId);
        }

        // Заполняем параметры
        fillParams(scenario.params);

        // Рисуем план
        drawPlan();
    } catch (e: any) {
        alert(e.message);
    }
}

// 4. Переключение этажа
floorSelect.onchange = () => {
    currentFloorId = Number(floorSelect.value);
    drawPlan();
};

// 5. Рисование SVG-плана
function drawPlan() {
    if (!building || !currentFloorId) {
        planContainer.innerHTML = '<p class="muted" style="padding:24px">Добавьте хотя бы один этаж.</p>';
        return;
    }

    const floor = building.floors.find(f => f.id === currentFloorId);
    if (!floor) return;

    planContainer.innerHTML = '';

    // Парсим SVG-строку и вставляем в контейнер
    const parser = new DOMParser();
    const doc = parser.parseFromString(floor.svg, 'image/svg+xml');
    const svg = doc.documentElement as unknown as SVGSVGElement;

    // Настраиваем атрибуты для корректного отображения
    svg.setAttribute('class', 'plan-svg');
    svg.setAttribute('viewBox', floor.vb.join(' '));
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.maxHeight = '70vh';

    // Группа для маркеров (чтобы они были поверх плана)
    const gMarks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMarks.setAttribute('id', 'marks-layer');
    svg.appendChild(gMarks);

    // Клик по SVG → поставить/удалить метку
    svg.addEventListener('click', (e) => handleSvgClick(e, svg, floor));

    planContainer.appendChild(svg);
    renderMarks(svg, floor);
}

// 6. Обработка клика по SVG
async function handleSvgClick(e: MouseEvent, svg: SVGSVGElement, floor: Floor) {
    if (!scenario) return;

    // Преобразуем экранные координаты в координаты SVG
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    // Радиус попадания (для удаления)
    const hitRadius = Math.max(floor.vb[2], floor.vb[3]) / 30;

    // Инструмент "Удалить"
    if (currentTool === 'del') {
        const index = pendingMarks.findIndex(m =>
            m.floorId === floor.id && Math.hypot(m.x - svgP.x, m.y - svgP.y) < hitRadius
        );
        if (index >= 0) {
            pendingMarks.splice(index, 1);
            drawPlan(); // Перерисовать
        }
        return;
    }

    // Инструмент "Очаг" (только один на сценарий)
    if (currentTool === 'fire') {
        scenario.fire = { floorId: floor.id, x: svgP.x, y: svgP.y };
        drawPlan();
        return;
    }

    // Инструменты "Лестница", "Выход", "Спавн"
    const width = (currentTool === 'spawn') ? null : parseFloat(widthInput.value) || 1;

    // Создаём временную метку (без ID, чтобы отобразить сразу)
    const tempMark: Mark = {
        id: -Date.now(), // временный id для React-ключа
        floorId: floor.id,
        kind: currentTool as 'stair' | 'exit' | 'spawn',
        x: svgP.x,
        y: svgP.y,
        width
    };

    pendingMarks.push(tempMark);
    drawPlan();
}

// 7. Отрисовка маркеров поверх плана
function renderMarks(svg: SVGSVGElement, floor: Floor) {
    const g = svg.querySelector('#marks-layer') as SVGGElement;
    if (!g || !scenario) return;

    g.innerHTML = ''; // Очищаем

    const r = Math.max(floor.vb[2], floor.vb[3]) / 50; // Радиус маркера
    const fontSize = r * 1.5;

    // Функция для рисования одной метки
    const drawMark = (x: number, y: number, color: string, label: string) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(x));
        circle.setAttribute('cy', String(y));
        circle.setAttribute('r', String(r));
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', String(r / 5));
        circle.setAttribute('class', 'marker');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(x));
        text.setAttribute('y', String(y - r * 1.5));
        text.setAttribute('font-size', String(fontSize));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', color);
        text.setAttribute('class', 'marker');
        text.textContent = label;

        g.appendChild(circle);
        g.appendChild(text);
    };

    // Рисуем все метки для текущего этажа
    pendingMarks.filter(m => m.floorId === floor.id).forEach(m => {
        let color = '';
        let label = '';
        if (m.kind === 'stair') { color = '#2d5fd0'; label = `Лестница ${m.width}м`; }
        if (m.kind === 'exit')  { color = '#0e8f5b'; label = `Выход ${m.width}м`; }
        if (m.kind === 'spawn') { color = '#b5730b'; label = 'Люди'; }
        drawMark(m.x, m.y, color, label);
    });

    // Рисуем очаг пожара (если на этом этаже)
    if (scenario.fire && scenario.fire.floorId === floor.id) {
        drawMark(scenario.fire.x, scenario.fire.y, '#d6361f', 'Очаг');
    }
}

// 8. Инструменты (кнопки)
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        currentTool = (btn as HTMLElement).dataset.tool!;
        wrapW.style.display = (currentTool === 'stair' || currentTool === 'exit') ? 'block' : 'none';
    });
});

// 9. Параметры
function fillParams(params: Params) {
    ($('#p-people') as HTMLInputElement).value = String(params.people);
    ($('#p-speed') as HTMLInputElement).value = String(params.speed);
    ($('#p-fireRate') as HTMLInputElement).value = String(params.fireRate);
    ($('#p-scale') as HTMLInputElement).value = String(params.scale);
    ($('#p-stairTime') as HTMLInputElement).value = String(params.stairTime);
    ($('#p-exitFlow') as HTMLInputElement).value = String(params.exitFlow);
    ($('#p-stairFlow') as HTMLInputElement).value = String(params.stairFlow);
}

function readParams(): Params {
    return {
        people: parseInt(($('#p-people') as HTMLInputElement).value, 10) || 40,
        speed: parseFloat(($('#p-speed') as HTMLInputElement).value) || 1.3,
        fireRate: parseFloat(($('#p-fireRate') as HTMLInputElement).value) || 0.4,
        scale: parseFloat(($('#p-scale') as HTMLInputElement).value) || 20.0,
        stairTime: parseFloat(($('#p-stairTime') as HTMLInputElement).value) || 12.0,
        exitFlow: parseFloat(($('#p-exitFlow') as HTMLInputElement).value) || 1.3,
        stairFlow: parseFloat(($('#p-stairFlow') as HTMLInputElement).value) || 1.0,
    };
}

// 10. Сохранение
$('#save-btn')!.addEventListener('click', async () => {
    if (!scenario) return;
    msgEl.textContent = 'Сохранение...';

    try {
        // 1. Обновляем сам сценарий (params, fire)
        await api.scenarios.update(BID, SID, {
            name: scenario.name,
            params: readParams(),
            fire: scenario.fire
        });

        // 2. Сохраняем метки (удаляем все и создаём заново — replace-all)
        await api.marks.deleteAll(BID, SID); // (в api.ts этот метод уже есть)

        for (const m of pendingMarks) {
            await api.marks.create(BID, SID, {
                floorId: m.floorId,
                kind: m.kind,
                x: m.x,
                y: m.y,
                width: m.width
            });
        }

        msgEl.textContent = 'Сохранено!';
        // Перезагружаем, чтобы получить актуальные ID меток
        await load();
    } catch (e: any) {
        msgEl.textContent = 'Ошибка: ' + e.message;
    }
});

// Инициализация
load();