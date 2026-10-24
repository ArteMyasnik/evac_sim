import { Auth } from '../auth';
import { api } from '../api';
import { $, cleanSvg } from '../shared';
import type { Building, BuildingSummary, Floor, ScenarioSummary } from '../types';

// 1. Получаем ID здания из URL (?id=1)
const urlParams = new URLSearchParams(window.location.search);
const BID = Number(urlParams.get('id'));

if (!BID) {
    alert('Не указан ID здания');
    location.href = '/buildings.html';
}

// 2. Переменные состояния
let currentBuilding: Building | null = null;
let activeTab: 'floors' | 'scenarios' = 'floors';

// DOM-элементы
const titleEl = $('#b-title') as HTMLSpanElement;
const descEl = $('#b-desc') as HTMLParagraphElement;
const viewFloors = $('#view-floors') as HTMLDivElement;
const viewScens = $('#view-scens') as HTMLDivElement;
const formFloor = $('#form-floor') as HTMLElement;
const formScen = $('#form-scen') as HTMLElement;
const tabFloors = $('#tab-floors') as HTMLButtonElement;
const tabScens = $('#tab-scens') as HTMLButtonElement;

// Защита страницы и рендер шапки
Auth.requireAuth().then(() => Auth.renderHeader('Редактор здания'));

// 3. Переключение табов
tabFloors.onclick = () => switchTab('floors');
tabScens.onclick = () => switchTab('scenarios');

function switchTab(tab: 'floors' | 'scenarios') {
    activeTab = tab;
    tabFloors.classList.toggle('on', tab === 'floors');
    tabScens.classList.toggle('on', tab === 'scenarios');

    viewFloors.style.display = tab === 'floors' ? 'block' : 'none';
    viewScens.style.display = tab === 'scenarios' ? 'block' : 'none';

    formFloor.style.display = tab === 'floors' ? 'block' : 'none';
    formScen.style.display = tab === 'scenarios' ? 'block' : 'none';
}

// 4. Загрузка данных здания
async function loadBuilding() {
    try {
        currentBuilding = await api.buildings.get(BID);
        titleEl.textContent = currentBuilding.name;
        descEl.textContent = currentBuilding.description || 'Без описания';
        renderFloors();
        renderScenarios();
    } catch (e: any) {
        alert(e.message);
        location.href = '/buildings.html';
    }
}

// 5. Отрисовка этажей
function renderFloors() {
    const list = $('#floors-list') as HTMLDivElement;
    if (!currentBuilding || currentBuilding.floors.length === 0) {
        list.innerHTML = '<p class="muted">Этажей пока нет. Добавьте первый.</p>';
        return;
    }

    list.innerHTML = '';
    currentBuilding.floors.sort((a, b) => a.level - b.level).forEach(f => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';

        card.innerHTML = `
      <div>
        <b>${f.name}</b> (уровень ${f.level})
      </div>
      <div>
        <button class="del" data-id="${f.id}" style="color:var(--fire); border:none; background:none; cursor:pointer;">Удалить</button>
      </div>
    `;
        list.appendChild(card);
    });

    // Обработчик удаления этажа
    list.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const fid = Number((e.target as HTMLElement).dataset.id);
            if (!confirm('Удалить этаж?')) return;
            try {
                await api.floors.delete(BID, fid);
                loadBuilding();
            } catch (err: any) {
                alert(err.message);
            }
        });
    });
}

// 6. Отрисовка сценариев
function renderScenarios() {
    const list = $('#scens-list') as HTMLDivElement;
    if (!currentBuilding || currentBuilding.scenarios.length === 0) {
        list.innerHTML = '<p class="muted">Сценариев пока нет. Создайте первый.</p>';
        return;
    }

    list.innerHTML = '';
    currentBuilding.scenarios.forEach(s => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';

        card.innerHTML = `
      <div>
        <b>${s.name}</b> ${s.isDefault ? '<span class="muted">(по умолчанию)</span>' : ''}
      </div>
      <div>
        <a href="/scenario.html?bid=${BID}&sid=${s.id}" class="btn">Настроить</a>
        ${!s.isDefault ? `<button class="def" data-id="${s.id}" style="margin-left:8px; border:none; background:none; cursor:pointer; color:var(--stair);">Сделать главным</button>` : ''}
        <button class="del" data-id="${s.id}" style="color:var(--fire); border:none; background:none; cursor:pointer; margin-left:8px;">Удалить</button>
      </div>
    `;
        list.appendChild(card);
    });

    // Обработчики
    list.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const sid = Number((e.target as HTMLElement).dataset.id);
            if (!confirm('Удалить сценарий?')) return;
            try {
                await api.scenarios.delete(BID, sid);
                loadBuilding();
            } catch (err: any) {
                alert(err.message);
            }
        });
    });

    list.querySelectorAll('.def').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const sid = Number((e.target as HTMLElement).dataset.id);
            try {
                await api.scenarios.setDefault(BID, sid);
                loadBuilding();
            } catch (err: any) {
                alert(err.message);
            }
        });
    });
}

// 7. Добавление этажа
$('#f-create')!.addEventListener('click', async () => {
    const name = ($('#f-name') as HTMLInputElement).value.trim();
    const level = parseInt(($('#f-level') as HTMLInputElement).value, 10);
    const fileInput = $('#f-file') as HTMLInputElement;
    const msg = $('#f-msg') as HTMLParagraphElement;

    if (!name || isNaN(level) || !fileInput.files?.length) {
        msg.textContent = 'Заполните все поля и выберите SVG.';
        return;
    }

    msg.textContent = 'Обработка...';
    try {
        const file = fileInput.files[0];
        const text = await file.text();
        const cleaned = cleanSvg(text); // Очищает SVG от скриптов

        await api.floors.create(BID, {
            name,
            level,
            svg: cleaned.svg,
            vb: cleaned.vb
        });

        msg.textContent = 'Этаж добавлен!';
        ($('#f-name') as HTMLInputElement).value = '';
        ($('#f-level') as HTMLInputElement).value = String(level + 1);
        fileInput.value = '';
        loadBuilding(); // обновляем список
    } catch (e: any) {
        msg.textContent = e.message;
    }
});

// 8. Создание сценария
$('#s-create')!.addEventListener('click', async () => {
    const name = ($('#s-name') as HTMLInputElement).value.trim();
    const msg = $('#s-msg') as HTMLParagraphElement;

    if (!name) {
        msg.textContent = 'Введите название.';
        return;
    }

    msg.textContent = 'Создаю...';
    try {
        await api.scenarios.create(BID, name);
        msg.textContent = 'Сценарий создан!';
        ($('#s-name') as HTMLInputElement).value = '';
        loadBuilding();
    } catch (e: any) {
        msg.textContent = e.message;
    }
});

// 9. Инициализация
switchTab('floors');
loadBuilding();