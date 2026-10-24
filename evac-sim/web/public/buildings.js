import{A as d,$ as r,a as i}from"./assets/shared-B-V0iPO6.js";d.requireAuth().then(()=>d.renderHeader("Мои здания"));const a=r("#list"),s=r("#msg"),o=r("#b-name"),u=r("#b-desc");async function l(){try{const t=await i.buildings.list();p(t)}catch(t){a.innerHTML=`<p class="error">${t.message}</p>`}}function p(t){if(t.length===0){a.innerHTML='<p class="muted">У вас пока нет зданий. Создайте первое.</p>';return}a.innerHTML="",t.forEach(e=>{const n=document.createElement("div");n.className="card",n.style.display="flex",n.style.justifyContent="space-between",n.style.alignItems="center",n.innerHTML=`
      <div>
        <b>${e.name}</b>
        <p class="muted" style="margin:4px 0">${e.description||"Без описания"}</p>
        <small class="muted">Этажей: ${e.floorCount} | Сценариев: ${e.scenarioCount}</small>
      </div>
      <div>
        <a href="/building.html?id=${e.id}" class="btn">Открыть</a>
        <button class="del" data-id="${e.id}" style="color:var(--fire); border:none; background:none; cursor:pointer; margin-left:8px;">Удалить</button>
      </div>
    `,a.appendChild(n)}),a.querySelectorAll(".del").forEach(e=>{e.addEventListener("click",async n=>{const c=n.target.dataset.id;if(c&&confirm("Удалить здание?"))try{await i.buildings.delete(Number(c)),l()}catch(m){alert(m.message)}})})}r("#create-btn").addEventListener("click",async()=>{const t=o.value.trim();if(!t){s.textContent="Введите название.";return}s.textContent="Создаю...";try{await i.buildings.create(t,u.value.trim()),o.value="",u.value="",s.textContent="Создано!",await l()}catch(e){s.textContent=e.message}});l();
