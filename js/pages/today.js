// ============================================================
//  TIMEREC — SEITE: HEUTE
// ============================================================

const PageToday = (() => {

  let stamps = [];
  let selectedTaskId = 0;
  let selectedTaskName = "";
  let tickInterval = null;

  // ── RENDER ───────────────────────────────────────────────

  function render() {
    const cfg = TimeRecSync.getConfig();
    const tasks = TimeRecSync.getTasks().filter(t => !t.inactive);
    const date = TimeRecCalc.today();
    const dc = TimeRecCalc.calcDay(
      stamps,
      cfg ? cfg.workSchedule : null,
      cfg ? cfg.autoBreaks : null,
      date
    );
    const decimal = cfg ? cfg.decimalTime : false;

    const isIn = dc.isOpen;

    document.getElementById("today-date").textContent = TimeRecCalc.formatDateLong(date);

    // Running time
    const runningEl = document.getElementById("today-running");
    if (isIn) {
      const elapsed = TimeRecCalc.parseTime(TimeRecCalc.nowTime()) - TimeRecCalc.parseTime(dc.openSince);
      runningEl.textContent = TimeRecCalc.formatHHMM(Math.max(0, elapsed));
      runningEl.style.display = "";
    } else {
      runningEl.style.display = "none";
    }

    // Punch-Knopf
    const btn = document.getElementById("punch-btn");
    btn.className = "punch-btn " + (isIn ? "punch-out" : "punch-in");
    btn.textContent = isIn ? "GEHT" : "KOMMT";

    const statusEl = document.getElementById("punch-status");
    statusEl.textContent = isIn ? `eingestempelt seit ${dc.openSince}` : "";

    // Aufgaben-Auswahl (nur wenn ausgestempelt)
    const taskSelect = document.getElementById("task-select");
    taskSelect.style.display = isIn ? "none" : "";
    taskSelect.innerHTML = `<option value="0">— Aufgabe —</option>` +
      tasks.map(t => `<option value="${t.id}" data-name="${t.name}" ${t.id === selectedTaskId ? "selected" : ""}>${t.name}</option>`).join("");

    // Tages-Fortschritt (nur wenn Sollzeit > 0)
    const progressEl = document.getElementById("today-progress");
    if (dc.sollMin > 0) {
      progressEl.style.display = "";
      document.getElementById("progress-ist").textContent = TimeRecCalc.formatDuration(dc.nettoMin, decimal);
      document.getElementById("progress-soll").textContent = TimeRecCalc.formatDuration(dc.sollMin, decimal);
      const deltaEl = document.getElementById("progress-delta");
      deltaEl.textContent = (dc.deltaMin >= 0 ? "+" : "") + TimeRecCalc.formatDuration(dc.deltaMin, decimal);
      deltaEl.className = "progress-delta " + (dc.deltaMin >= 0 ? "pos" : "neg");
    } else {
      progressEl.style.display = "none";
    }

    // Stempelliste
    renderStampList(stamps, dc, decimal);
  }

  function renderStampList(stamps, dc, decimal) {
    const list = document.getElementById("stamp-list");
    const sorted = [...stamps].sort((a, b) => a.time.localeCompare(b.time));
    const date = TimeRecCalc.today();

    if (!sorted.length) {
      list.innerHTML = `<div class="empty-state">Noch keine Einträge heute.</div>`;
      return;
    }

    list.innerHTML = sorted.map(s => {
      const isOpen = dc.openSession && dc.openSession.id === s.id;
      const actionLabel = s.action === "in" ? "Kommt" : "Geht";
      const dot = `<span class="stamp-dot ${s.action}"></span>`;
      const timeDisplay = isOpen
        ? `<span class="stamp-time open" id="live-time">${TimeRecCalc.nowTime()}</span>`
        : `<input class="stamp-time-input" type="time" value="${s.time}" data-id="${s.id}" data-date="${s.date}">`;
      const badge = isOpen
        ? `<span class="stamp-badge open">läuft…</span>`
        : `<span class="stamp-badge ${s.action}">${actionLabel}</span>`;
      const task = s.taskName ? `<span class="stamp-task">${s.taskName}</span>` : "";
      const del = `<button class="stamp-delete" data-id="${s.id}" title="Löschen">×</button>`;
      return `<div class="stamp-row">${dot}${timeDisplay}${badge}${task}${del}</div>`;
    }).join("");

    // Events
    list.querySelectorAll(".stamp-time-input").forEach(inp => {
      inp.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const newTime = e.target.value;
        await TimeRecSync.updateStamp(id, { time: newTime });
        stamps = stamps.map(s => s.id === id ? { ...s, time: newTime } : s);
        render();
      });
    });

    list.querySelectorAll(".stamp-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (!confirm("Eintrag löschen?")) return;
        await TimeRecSync.deleteStamp(id);
        stamps = stamps.filter(s => s.id !== id);
        render();
      });
    });
  }

  // ── STEMPELN ─────────────────────────────────────────────

  async function punch() {
    const cfg = TimeRecSync.getConfig();
    const dc = TimeRecCalc.calcDay(
      stamps,
      cfg ? cfg.workSchedule : null,
      cfg ? cfg.autoBreaks : null,
      TimeRecCalc.today()
    );
    const action = dc.isOpen ? "out" : "in";
    const time = TimeRecCalc.nowTime();
    const date = TimeRecCalc.today();

    // Task aus Auswahl
    const sel = document.getElementById("task-select");
    const taskId = parseInt(sel.value) || 0;
    const taskName = taskId ? sel.options[sel.selectedIndex].dataset.name : "";

    const stamp = await TimeRecSync.createStamp(date, time, action, taskId, taskName, "");
    stamps.push(stamp);
    stamps.sort((a, b) => a.time.localeCompare(b.time));
    render();
    TimeRecUI.showToast(action === "in" ? "Eingestempelt ✓" : "Ausgestempelt ✓", "success");
  }

  // ── PAUSENVORLAGEN MODAL ─────────────────────────────────

  function openBreakModal() {
    const cfg = TimeRecSync.getConfig();
    const dc = TimeRecCalc.calcDay(
      stamps,
      cfg ? cfg.workSchedule : null,
      cfg ? cfg.autoBreaks : null,
      TimeRecCalc.today()
    );
    const isIn = dc.isOpen;
    const templates = TimeRecSync.getBreakTemplates();

    const modal = document.getElementById("break-modal");
    const content = document.getElementById("break-modal-content");

    content.innerHTML = `
      <h3>Pausenvorlage</h3>
      ${templates.length ? templates.map(t => {
        const disabled = !isIn ? "disabled" : "";
        let label = t.name;
        if (t.type === "fixed") label += ` (${t.startTime}–${t.endTime})`;
        else if (t.type === "next") label += ` (+${t.durationMinutes} min)`;
        else if (t.type === "last") label += ` (−${t.durationMinutes} min)`;
        return `<button class="break-template-btn" data-id="${t.id}" ${disabled}>${label}</button>`;
      }).join("") : `<p class="muted">Keine Vorlagen. In Einstellungen anlegen.</p>`}
      <button class="btn-secondary" id="break-modal-close">Abbrechen</button>
    `;

    modal.style.display = "flex";

    content.querySelectorAll(".break-template-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const template = templates.find(t => t.id === id);
        if (!template) return;
        const times = TimeRecCalc.calcBreakTimes(template);
        if (!times) return;
        const date = TimeRecCalc.today();
        const sel = document.getElementById("task-select");
        const taskId = parseInt(sel.value) || 0;
        const taskName = taskId ? sel.options[sel.selectedIndex]?.dataset.name : "";

        // out-Stempel
        const outStamp = await TimeRecSync.createStamp(date, times.outTime, "out", taskId, taskName, "");
        stamps.push(outStamp);
        // in-Stempel
        const inStamp = await TimeRecSync.createStamp(date, times.inTime, "in", taskId, taskName, "");
        stamps.push(inStamp);
        stamps.sort((a, b) => a.time.localeCompare(b.time));

        modal.style.display = "none";
        render();
        TimeRecUI.showToast("Pause eingetragen ✓", "success");
      });
    });

    document.getElementById("break-modal-close").addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  // ── TICK (live update alle 30s) ──────────────────────────

  function startTick() {
    stopTick();
    tickInterval = setInterval(() => {
      const cfg = TimeRecSync.getConfig();
      const dc = TimeRecCalc.calcDay(
        stamps,
        cfg ? cfg.workSchedule : null,
        cfg ? cfg.autoBreaks : null,
        TimeRecCalc.today()
      );
      if (dc.isOpen) render();
    }, 30000);
  }

  function stopTick() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = null;
  }

  // ── INIT ─────────────────────────────────────────────────

  async function init() {
    stamps = await TimeRecAPI.getStampsForDate(TimeRecCalc.today());
    render();
    startTick();

    document.getElementById("punch-btn").addEventListener("click", punch);
    document.getElementById("break-modal-btn").addEventListener("click", openBreakModal);

    document.getElementById("break-modal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("break-modal")) {
        document.getElementById("break-modal").style.display = "none";
      }
    });

    document.getElementById("task-select").addEventListener("change", (e) => {
      selectedTaskId = parseInt(e.target.value) || 0;
      const opt = e.target.options[e.target.selectedIndex];
      selectedTaskName = opt ? (opt.dataset.name || "") : "";
    });
  }

  function destroy() {
    stopTick();
  }

  return { init, destroy, render };

})();
