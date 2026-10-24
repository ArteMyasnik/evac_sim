import { Auth } from '../auth';
import { api } from '../api';
import { $ } from '../shared';
import type { BuildingSummary } from '../types';

// Защита страницы
Auth.requireAuth().then(() => Auth.renderHeader('Мои здания'));

const listEl = $('#list') as HTMLDivElement;
const msgEl = $('#msg') as HTMLParagraphElement;
const nameInput = $('#b-name') as HTMLInputElement;
const descInput = $('#b-desc') as HTMLInputElement;

async function loadBuildings() {
    try {
        const buildings = await api.buildings.list();
        renderList(buildings);
    } catch (e: any) {
        listEl.innerHTML = `<p class="error">${e.message}</p>`;
    }
}

function renderList(buildings: BuildingSummary[]) {
    if (buildings.length === 0) {
        listEl.innerHTML = '<p class="muted">У вас пока нет зданий. Создайте первое.</p>';
        return;
    }

    listEl.innerHTML = '';
    buildings.forEach(b => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';

        card.innerHTML = `
      <div>
        <b>${b.name}</b>
        <p class="muted" style="margin:4px 0">${b.description || 'Без описания'}</p>
        <small class="muted">Этажей: ${b.floorCount} | Сценариев: ${b.scenarioCount}</small>
      </div>
      <div>
        <a href="/building.html?id=${b.id}" class="btn">Открыть</a>
        <button class="del" data-id="${b.id}" style="color:var(--fire); border:none; background:none; cursor:pointer; margin-left:8px;">Удалить</button>
      </div>
    `;
        listEl.appendChild(card);
    });

    // Привязываем обработчики удаления
    listEl.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = (e.target as HTMLElement).dataset.id;
            if (!id) return;
            if (!confirm('Удалить здание?')) return;

            try {
                await api.buildings.delete(Number(id));
                loadBuildings(); // обновить список
            } catch (err: any) {
                alert(err.message);
            }
        });
    });
}

$('#create-btn')!.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
        msgEl.textContent = 'Введите название.';
        return;
    }
    msgEl.textContent = 'Создаю...';
    try {
        await api.buildings.create(name, descInput.value.trim());
        nameInput.value = '';
        descInput.value = '';
        msgEl.textContent = 'Создано!';
        await loadBuildings();
    } catch (e: any) {
        msgEl.textContent = e.message;
    }
});

// Первичная загрузка
loadBuildings();