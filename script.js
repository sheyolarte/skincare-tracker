(() => {
  const STORAGE_KEY = "skincareTrackerData";

  const MONTH_NAMES = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];

  const defaultData = () => ({
    products: {
      AM: [
        { id: "am-cleanser", name: "Cleanser" },
        { id: "am-vitc", name: "Vitamin C Serum" },
        { id: "am-moisturizer", name: "Moisturizer" },
        { id: "am-spf", name: "Sunscreen" }
      ],
      PM: [
        { id: "pm-cleanser", name: "Cleanser" },
        { id: "pm-tretinoin", name: "Tretinoin", active: true },
        { id: "pm-moisturizer", name: "Moisturizer" }
      ]
    },
    checks: {} // "YYYY-MM-DD" -> { productId: true }
  });

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      if (!parsed.products || !parsed.checks) return defaultData();
      return parsed;
    } catch (e) {
      return defaultData();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    flashSaveStatus();
  }

  let flashTimer = null;
  function flashSaveStatus() {
    const el = document.getElementById("saveStatus");
    el.textContent = "Saved " + new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.textContent = ""; }, 2500);
  }

  const today = new Date();
  const state = {
    data: loadData(),
    viewYear: today.getFullYear(),
    viewMonth: today.getMonth(), // 0-indexed
    pendingSection: null
  };

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function isChecked(dk, productId) {
    return !!(state.data.checks[dk] && state.data.checks[dk][productId]);
  }

  function toggleCheck(dk, productId) {
    if (!state.data.checks[dk]) state.data.checks[dk] = {};
    if (state.data.checks[dk][productId]) {
      delete state.data.checks[dk][productId];
      if (Object.keys(state.data.checks[dk]).length === 0) delete state.data.checks[dk];
    } else {
      state.data.checks[dk][productId] = true;
    }
    saveData();
    renderBadges();
  }

  function allProducts() {
    return [...state.data.products.AM.map(p => ({...p, section:"AM"})),
            ...state.data.products.PM.map(p => ({...p, section:"PM"}))];
  }

  function lastUsedDate(productId) {
    const keys = Object.keys(state.data.checks)
      .filter(k => state.data.checks[k][productId])
      .sort(); // ascending ISO strings sort correctly
    if (keys.length === 0) return null;
    return keys[keys.length - 1];
  }

  function daysAgo(isoDate) {
    const d = new Date(isoDate + "T00:00:00");
    const now = new Date();
    now.setHours(0,0,0,0);
    return Math.round((now - d) / 86400000);
  }

  function formatLastUsed(productId) {
    const d = lastUsedDate(productId);
    if (!d) return "never logged";
    const ago = daysAgo(d);
    if (ago === 0) return "used today";
    if (ago === 1) return "used yesterday";
    return `last used ${ago}d ago`;
  }

  function renderMonthLabel() {
    document.getElementById("monthLabel").textContent =
      `${MONTH_NAMES[state.viewMonth]} ${state.viewYear}`;
  }

  function renderTable(section) {
    const table = document.getElementById(`table-${section}`);
    const products = state.data.products[section];
    const dim = daysInMonth(state.viewYear, state.viewMonth);
    const isCurrentMonth = state.viewYear === today.getFullYear() && state.viewMonth === today.getMonth();

    let html = "<thead><tr><th class='product-col'></th>";
    for (let d = 1; d <= dim; d++) {
      const isToday = isCurrentMonth && d === today.getDate();
      html += `<th class="${isToday ? "today" : ""}">${d}</th>`;
    }
    html += "</tr></thead><tbody>";

    products.forEach((p, idx) => {
      html += `<tr class="${p.active ? "active-row" : ""}" data-idx="${idx}">`;
      html += `<td class="product-col">
                  <div class="prod-name">
                    <span class="drag-handle" title="Drag to reorder">⠿</span>
                    <span>${escapeHtml(p.name)}</span>
                    ${p.active ? '<span class="rx-tag">ACTIVE</span>' : ''}
                    <button class="remove-x" data-remove="${p.id}" data-section="${section}" title="Remove">✕</button>
                  </div>
                  <span class="last-used" data-lastused="${p.id}">${formatLastUsed(p.id)}</span>
                </td>`;
      for (let d = 1; d <= dim; d++) {
        const dk = dateKey(state.viewYear, state.viewMonth, d);
        const isToday = isCurrentMonth && d === today.getDate();
        const checked = isChecked(dk, p.id);
        html += `<td class="day-col ${isToday ? "today" : ""}">
                    <input type="checkbox" class="chk" ${checked ? "checked" : ""}
                      data-date="${dk}" data-product="${p.id}">
                  </td>`;
      }
      html += "</tr>";
    });

    html += "</tbody>";
    table.innerHTML = html;

    table.querySelectorAll(".chk").forEach(cb => {
      cb.addEventListener("change", (e) => {
        toggleCheck(e.target.dataset.date, e.target.dataset.product);
        updateLastUsedLabels();
      });
    });

    table.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.dataset.remove;
        const sec = e.target.dataset.section;
        if (confirm("Remove this product from your routine? Logged history stays saved but hidden.")) {
          state.data.products[sec] = state.data.products[sec].filter(p => p.id !== id);
          saveData();
          renderAll();
        }
      });
    });

    setupDragReorder(table, section);
  }

  // Pointer-based reordering (native HTML5 drag-and-drop is unreliable on
  // table rows across browsers, especially Safari, so we track the drag by hand).
  function setupDragReorder(table, section) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    let dragTr = null;
    let dragIdx = null;
    let insertIdx = null;

    function rowsList() {
      return Array.from(tbody.querySelectorAll("tr"));
    }

    function otherRows() {
      return rowsList().filter(r => r !== dragTr);
    }

    function clearHoverStyles() {
      rowsList().forEach(r => r.classList.remove("drag-over"));
    }

    // Returns the index (within the array minus the dragged item) where the
    // dragged item should land, based on cursor position relative to row midpoints.
    function findInsertIndex(clientY) {
      const others = otherRows();
      for (let i = 0; i < others.length; i++) {
        const rect = others[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (clientY < mid) return i;
      }
      return others.length;
    }

    function onPointerMove(e) {
      if (!dragTr) return;
      e.preventDefault();
      insertIdx = findInsertIndex(e.clientY);
      clearHoverStyles();
      const others = otherRows();
      const highlightRow = others[insertIdx] || others[others.length - 1];
      if (highlightRow) highlightRow.classList.add("drag-over");
    }

    function onPointerUp() {
      if (!dragTr) return;
      dragTr.classList.remove("dragging");
      clearHoverStyles();
      document.body.classList.remove("no-select");

      if (insertIdx !== null) {
        const arr = state.data.products[section];
        const [moved] = arr.splice(dragIdx, 1);
        arr.splice(insertIdx, 0, moved);
        saveData();
        renderTable(section);
      }

      dragTr = null;
      dragIdx = null;
      insertIdx = null;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    }

    tbody.querySelectorAll(".drag-handle").forEach(handle => {
      handle.style.touchAction = "none";
      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const tr = handle.closest("tr");
        if (!tr) return;
        dragTr = tr;
        dragIdx = parseInt(tr.dataset.idx, 10);
        insertIdx = dragIdx;
        tr.classList.add("dragging");
        document.body.classList.add("no-select");
        e.preventDefault();
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
      });
    });
  }

  function updateLastUsedLabels() {
    allProducts().forEach(p => {
      const el = document.querySelector(`[data-lastused="${p.id}"]`);
      if (el) el.textContent = formatLastUsed(p.id);
    });
  }

  function renderBadges() {
    const wrap = document.getElementById("activeBadges");
    const actives = allProducts().filter(p => p.active);
    if (actives.length === 0) { wrap.innerHTML = ""; return; }

    wrap.innerHTML = actives.map(p => {
      const d = lastUsedDate(p.id);
      let cls = "due", text;
      if (!d) {
        text = "never logged";
      } else {
        const ago = daysAgo(d);
        text = ago === 0 ? "used today" : ago === 1 ? "used yesterday" : `${ago} days ago`;
        cls = ago <= 1 ? "ok" : ago <= 3 ? "warn" : "due";
      }
      return `<div class="badge ${cls}">💊 <strong>${escapeHtml(p.name)}</strong> — <span class="badge-days">${text}</span></div>`;
    }).join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderAll() {
    renderMonthLabel();
    renderTable("AM");
    renderTable("PM");
    renderBadges();
  }

  // ---- Month navigation ----
  document.getElementById("prevMonth").addEventListener("click", () => {
    state.viewMonth--;
    if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
    renderAll();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    state.viewMonth++;
    if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
    renderAll();
  });

  // ---- Add product modal ----
  const overlay = document.getElementById("modalOverlay");
  document.querySelectorAll(".add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.pendingSection = btn.dataset.section;
      document.getElementById("modalName").value = "";
      document.getElementById("modalActive").checked = false;
      overlay.classList.remove("hidden");
      document.getElementById("modalName").focus();
    });
  });
  document.getElementById("modalCancel").addEventListener("click", () => {
    overlay.classList.add("hidden");
  });
  document.getElementById("modalSave").addEventListener("click", () => {
    const name = document.getElementById("modalName").value.trim();
    if (!name) return;
    const active = document.getElementById("modalActive").checked;
    const section = state.pendingSection;
    const id = section.toLowerCase() + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
    state.data.products[section].push({ id, name, active });
    saveData();
    overlay.classList.add("hidden");
    renderAll();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });

  // ---- Reset month ----
  document.getElementById("resetBtn").addEventListener("click", () => {
    const dim = daysInMonth(state.viewYear, state.viewMonth);
    if (!confirm(`Clear all checkmarks for ${MONTH_NAMES[state.viewMonth]} ${state.viewYear}?`)) return;
    for (let d = 1; d <= dim; d++) {
      delete state.data.checks[dateKey(state.viewYear, state.viewMonth, d)];
    }
    saveData();
    renderAll();
  });

  // ---- Export to Markdown ----
  function buildMarkdown() {
    const dim = daysInMonth(state.viewYear, state.viewMonth);
    const monthTitle = `${MONTH_NAMES[state.viewMonth]} ${state.viewYear}`;
    let md = `# Skincare Routine Tracker — ${monthTitle}\n\n`;
    md += `_Last saved: ${new Date().toLocaleString()}_\n\n`;

    const actives = allProducts().filter(p => p.active);
    if (actives.length) {
      md += `## Actives status\n\n`;
      actives.forEach(p => {
        md += `- **${p.name}**: ${formatLastUsed(p.id)}\n`;
      });
      md += `\n`;
    }

    ["AM", "PM"].forEach(section => {
      const label = section === "AM" ? "Morning" : "Evening";
      const products = state.data.products[section];
      if (!products.length) return;
      md += `## ${label}\n\n`;
      const dayHeaders = Array.from({length: dim}, (_, i) => i + 1);
      md += `| Product | ${dayHeaders.join(" | ")} |\n`;
      md += `|---|${dayHeaders.map(() => "---").join("|")}|\n`;
      products.forEach(p => {
        const row = dayHeaders.map(d => {
          const dk = dateKey(state.viewYear, state.viewMonth, d);
          return isChecked(dk, p.id) ? "✅" : "⬜";
        });
        md += `| ${p.name}${p.active ? " 💊" : ""} | ${row.join(" | ")} |\n`;
      });
      md += `\n`;
    });

    return md;
  }

  document.getElementById("exportBtn").addEventListener("click", () => {
    const md = buildMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname = `progress-${state.viewYear}-${pad(state.viewMonth + 1)}.md`;
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const el = document.getElementById("saveStatus");
    el.textContent = `Downloaded ${fname}`;
  });

  renderAll();
})();
