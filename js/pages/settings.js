// ============================================================
//  TIMEREC — SEITE: EINSTELLUNGEN
// ============================================================

const PageSettings = (() => {

  let cfg = null;
  let tasks = [];
  let breakTemplates = [];

  async function init() {
    cfg = TimeRecSync.getConfig();
    tasks = TimeRecSync.getTasks();
    breakTemplates = TimeRecSync.getBreakTemplates();
    render();
  }

  function render() {
    if (!cfg) return;
    renderWorkSchedule();
    renderAutoBreaks();
    renderAutoPunchOut();
    renderBreakTemplates();
    renderDecimalTime();
    renderTasks();
  }

  // ── SOLLZEIT PRO WOCHENTAG ───────────────────────────────

  function renderWorkSchedule() {
    const ws = cfg.workSchedule || {};
    const days = [
      ["monday","Mo"], ["tuesday","Di"], ["wednesday","Mi"],
      ["thursday","Do"], ["friday","Fr"], ["saturday","Sa"], ["sunday","So"]
    ];
    const container = document.getElementById("settings-schedule");
    container.innerHTML = days.map(([key, label]) =>
      `<div class="setting-row">
        <label>${label}</label>
        <input type="time" id="sched-${key}" value="${ws[key] || "00:00"}">
      </div>`
    ).join("") +
    `<button class="btn-primary" id="save-schedule">Speichern</button>`;

    document.getElementById("save-schedule").addEventListener("click", async () => {
      const newWs = {};
      days.forEach(([key]) => {
        newWs[key] = document.getElementById(`sched-${key}`).value || "00:00";
      });
      cfg.workSchedule = newWs;
      await TimeRecAPI.saveConfig(cfg.id, cfg.workSchedule, cfg.autoPunchOut, cfg.autoBreaks, cfg.decimalTime);
      TimeRecUI.showToast("Sollzeit gespeichert ✓", "success");
    });
  }

  // ── AUTO-PAUSEN ──────────────────────────────────────────

  function renderAutoBreaks() {
    const ab = cfg.autoBreaks || { enabled: false, rules: [] };
    const container = document.getElementById("settings-autobreaks");

    container.innerHTML = `
      <div class="setting-row">
        <label>Auto-Pausen aktiv</label>
        <input type="checkbox" id="autobreaks-enabled" ${ab.enabled ? "checked" : ""}>
      </div>
      <div id="autobreaks-rules">
        ${(ab.rules || []).map((r, i) =>
          `<div class="rule-row" data-index="${i}">
            <span>Ab</span>
            <input type="number" class="rule-threshold" value="${Math.round(r.threshold/60*10)/10}" min="0" step="0.5" title="Stunden">
            <span>h →</span>
            <input type="number" class="rule-break" value="${r.break}" min="0" title="Minuten Pause">
            <span>min Pause</span>
            <button class="btn-icon rule-delete" data-index="${i}">×</button>
          </div>`
        ).join("")}
      </div>
      <button class="btn-secondary" id="add-break-rule">+ Regel hinzufügen</button>
      <button class="btn-primary" id="save-autobreaks">Speichern</button>
    `;

    document.getElementById("autobreaks-enabled").addEventListener("change", (e) => {
      ab.enabled = e.target.checked;
    });

    document.getElementById("add-break-rule").addEventListener("click", () => {
      ab.rules = ab.rules || [];
      ab.rules.push({ threshold: 480, break: 30 });
      cfg.autoBreaks = ab;
      renderAutoBreaks();
    });

    container.querySelectorAll(".rule-delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index);
        ab.rules.splice(i, 1);
        cfg.autoBreaks = ab;
        renderAutoBreaks();
      });
    });

    document.getElementById("save-autobreaks").addEventListener("click", async () => {
      const rules = [];
      container.querySelectorAll(".rule-row").forEach(row => {
        const th = parseFloat(row.querySelector(".rule-threshold").value) * 60;
        const br = parseInt(row.querySelector(".rule-break").value);
        if (!isNaN(th) && !isNaN(br)) rules.push({ threshold: Math.round(th), break: br });
      });
      rules.sort((a, b) => a.threshold - b.threshold);
      cfg.autoBreaks = { enabled: document.getElementById("autobreaks-enabled").checked, rules };
      await TimeRecAPI.saveConfig(cfg.id, cfg.workSchedule, cfg.autoPunchOut, cfg.autoBreaks, cfg.decimalTime);
      TimeRecUI.showToast("Auto-Pausen gespeichert ✓", "success");
    });
  }

  // ── AUTO-AUSSTEMPELN ─────────────────────────────────────

  function renderAutoPunchOut() {
    const ap = cfg.autoPunchOut || { enabled: false, time: "20:00" };
    const container = document.getElementById("settings-autopunchout");
    container.innerHTML = `
      <div class="setting-row">
        <label>Auto-Ausstempeln aktiv</label>
        <input type="checkbox" id="autopunchout-enabled" ${ap.enabled ? "checked" : ""}>
      </div>
      <div class="setting-row">
        <label>Uhrzeit</label>
        <input type="time" id="autopunchout-time" value="${ap.time || "20:00"}">
      </div>
      <button class="btn-primary" id="save-autopunchout">Speichern</button>
    `;
    document.getElementById("save-autopunchout").addEventListener("click", async () => {
      cfg.autoPunchOut = {
        enabled: document.getElementById("autopunchout-enabled").checked,
        time: document.getElementById("autopunchout-time").value
      };
      await TimeRecAPI.saveConfig(cfg.id, cfg.workSchedule, cfg.autoPunchOut, cfg.autoBreaks, cfg.decimalTime);
      TimeRecUI.showToast("Auto-Ausstempeln gespeichert ✓", "success");
    });
  }

  // ── PAUSENVORLAGEN ───────────────────────────────────────

  function renderBreakTemplates() {
    const container = document.getElementById("settings-break-templates");
    container.innerHTML = breakTemplates.map(t => {
      let desc = "";
      if (t.type === "fixed") desc = `${t.startTime}–${t.endTime}`;
      else if (t.type === "next") desc = `+${t.durationMinutes} min`;
      else if (t.type === "last") desc = `−${t.durationMinutes} min`;
      return `<div class="template-row">
        <span class="template-name">${t.name}</span>
        <span class="template-desc muted">${desc}</span>
        <button class="btn-icon template-delete" data-id="${t.id}">×</button>
      </div>`;
    }).join("") +
    `<div class="template-form">
      <input type="text" id="new-tmpl-name" placeholder="Name (z.B. Mittagspause)">
      <select id="new-tmpl-type">
        <option value="fixed">Feste Zeiten</option>
        <option value="next">Nächste X min</option>
        <option value="last">Letzte X min</option>
      </select>
      <div id="new-tmpl-fixed">
        <input type="time" id="new-tmpl-start" value="12:00">
        <span>–</span>
        <input type="time" id="new-tmpl-end" value="12:30">
      </div>
      <div id="new-tmpl-duration" style="display:none">
        <input type="number" id="new-tmpl-dur" value="15" min="1"> min
      </div>
      <button class="btn-secondary" id="add-break-template">+ Hinzufügen</button>
    </div>`;

    document.getElementById("new-tmpl-type").addEventListener("change", (e) => {
      const isFixed = e.target.value === "fixed";
      document.getElementById("new-tmpl-fixed").style.display = isFixed ? "" : "none";
      document.getElementById("new-tmpl-duration").style.display = isFixed ? "none" : "";
    });

    container.querySelectorAll(".template-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Vorlage löschen?")) return;
        await TimeRecAPI.deleteBreakTemplate(btn.dataset.id);
        breakTemplates = breakTemplates.filter(t => t.id !== btn.dataset.id);
        renderBreakTemplates();
        TimeRecUI.showToast("Vorlage gelöscht", "success");
      });
    });

    document.getElementById("add-break-template").addEventListener("click", async () => {
      const name = document.getElementById("new-tmpl-name").value.trim();
      if (!name) { TimeRecUI.showToast("Name eingeben", "error"); return; }
      const type = document.getElementById("new-tmpl-type").value;
      const fields = { name, type, sortNr: breakTemplates.length };
      if (type === "fixed") {
        fields.startTime = document.getElementById("new-tmpl-start").value;
        fields.endTime = document.getElementById("new-tmpl-end").value;
      } else {
        fields.durationMinutes = parseInt(document.getElementById("new-tmpl-dur").value) || 15;
      }
      const rec = await TimeRecAPI.createBreakTemplate(fields);
      breakTemplates.push({ id: rec.id, ...rec.fields });
      renderBreakTemplates();
      TimeRecUI.showToast("Vorlage hinzugefügt ✓", "success");
    });
  }

  // ── ZEITFORMAT ───────────────────────────────────────────

  function renderDecimalTime() {
    const container = document.getElementById("settings-timeformat");
    container.innerHTML = `
      <label class="radio-label">
        <input type="radio" name="timeformat" value="hhmm" ${!cfg.decimalTime ? "checked" : ""}> HH:MM
      </label>
      <label class="radio-label">
        <input type="radio" name="timeformat" value="decimal" ${cfg.decimalTime ? "checked" : ""}> Dezimal
      </label>
    `;
    container.querySelectorAll("input[name=timeformat]").forEach(r => {
      r.addEventListener("change", async (e) => {
        cfg.decimalTime = e.target.value === "decimal";
        await TimeRecAPI.saveConfig(cfg.id, cfg.workSchedule, cfg.autoPunchOut, cfg.autoBreaks, cfg.decimalTime);
        TimeRecUI.showToast("Zeitformat gespeichert ✓", "success");
      });
    });
  }

  // ── AUFGABEN ─────────────────────────────────────────────

  function renderTasks() {
    const container = document.getElementById("settings-tasks");
    container.innerHTML = tasks.map(t =>
      `<div class="task-row">
        <input class="task-name-input" type="text" value="${t.name}" data-id="${t.id}">
        <label class="toggle-label" title="Aktiv">
          <input type="checkbox" class="task-active" data-id="${t.id}" ${!t.inactive ? "checked" : ""}> Aktiv
        </label>
        <button class="btn-icon task-delete" data-id="${t.id}">×</button>
      </div>`
    ).join("") +
    `<div class="task-add-form">
      <input type="text" id="new-task-name" placeholder="Neue Aufgabe">
      <button class="btn-secondary" id="add-task">+ Hinzufügen</button>
    </div>`;

    container.querySelectorAll(".task-name-input").forEach(inp => {
      inp.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        await TimeRecAPI.updateTask(id, { name: e.target.value });
        tasks = tasks.map(t => t.id === id ? { ...t, name: e.target.value } : t);
        TimeRecUI.showToast("Aufgabe aktualisiert ✓", "success");
      });
    });

    container.querySelectorAll(".task-active").forEach(cb => {
      cb.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        await TimeRecAPI.updateTask(id, { inactive: !e.target.checked });
        tasks = tasks.map(t => t.id === id ? { ...t, inactive: !e.target.checked } : t);
      });
    });

    container.querySelectorAll(".task-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Aufgabe löschen?")) return;
        await TimeRecAPI.deleteTask(btn.dataset.id);
        tasks = tasks.filter(t => t.id !== btn.dataset.id);
        renderTasks();
        TimeRecUI.showToast("Aufgabe gelöscht", "success");
      });
    });

    document.getElementById("add-task").addEventListener("click", async () => {
      const name = document.getElementById("new-task-name").value.trim();
      if (!name) return;
      const rec = await TimeRecAPI.createTask(name, tasks.length * 10);
      tasks.push({ id: rec.id, name, sortNr: tasks.length * 10, inactive: false });
      document.getElementById("new-task-name").value = "";
      renderTasks();
      TimeRecUI.showToast("Aufgabe hinzugefügt ✓", "success");
    });
  }

  return { init };

})();
