// ============================================================
//  TIMEREC — SEITE: VERLAUF
// ============================================================

const PageHistory = (() => {

  let currentDate = TimeRecCalc.today();
  let stamps = [];
  let noteRecord = null;

  function init() {
    currentDate = TimeRecCalc.today();
    render();

    document.getElementById("history-prev").addEventListener("click", () => navigate(-1));
    document.getElementById("history-next").addEventListener("click", () => navigate(1));
    document.getElementById("history-today-link").addEventListener("click", () => {
      currentDate = TimeRecCalc.today();
      render();
    });
  }

  function navigate(dir) {
    const d = TimeRecCalc.isoToDate(currentDate);
    d.setDate(d.getDate() + dir);
    currentDate = TimeRecCalc.dateToISO(d);
    render();
  }

  async function render() {
    const cfg = TimeRecSync.getConfig();
    const decimal = cfg ? cfg.decimalTime : false;
    const todayISO = TimeRecCalc.today();

    document.getElementById("history-date").textContent = TimeRecCalc.formatDateLong(currentDate);
    document.getElementById("history-today-link").style.display = currentDate === todayISO ? "none" : "";

    // Stamps + Notiz laden
    try {
      [stamps, noteRecord] = await Promise.all([
        TimeRecAPI.getStampsForDate(currentDate),
        TimeRecAPI.getNote(currentDate)
      ]);
    } catch (e) {
      TimeRecUI.showToast("Fehler beim Laden", "error");
      return;
    }

    const dc = TimeRecCalc.calcDay(
      stamps,
      cfg ? cfg.workSchedule : null,
      cfg ? cfg.autoBreaks : null,
      currentDate
    );

    // Ist/Soll/Delta
    const statsEl = document.getElementById("history-stats");
    if (dc.sollMin > 0 || dc.nettoMin > 0) {
      statsEl.style.display = "";
      document.getElementById("history-ist").textContent = TimeRecCalc.formatDuration(dc.nettoMin, decimal);
      document.getElementById("history-soll").textContent = dc.sollMin > 0 ? TimeRecCalc.formatDuration(dc.sollMin, decimal) : "—";
      const deltaEl = document.getElementById("history-delta");
      if (dc.sollMin > 0) {
        deltaEl.textContent = (dc.deltaMin >= 0 ? "+" : "") + TimeRecCalc.formatDuration(dc.deltaMin, decimal);
        deltaEl.className = "history-delta-val " + (dc.deltaMin >= 0 ? "pos" : "neg");
      } else {
        deltaEl.textContent = "—";
        deltaEl.className = "history-delta-val";
      }
    } else {
      statsEl.style.display = "none";
    }

    // Stempelliste
    renderStampList(dc, decimal);

    // Notiz
    const noteEl = document.getElementById("history-note");
    noteEl.value = noteRecord ? noteRecord.text : "";

    // Abwesenheits-Templates
    renderAbsenceButtons();
  }

  function renderStampList(dc, decimal) {
    const list = document.getElementById("history-stamp-list");
    const sorted = [...stamps].sort((a, b) => a.time.localeCompare(b.time));

    if (!sorted.length) {
      list.innerHTML = `<div class="empty-state">Keine Einträge.</div>`;
      return;
    }

    list.innerHTML = sorted.map(s => {
      const actionLabel = s.action === "in" ? "Kommt" : "Geht";
      const dot = `<span class="stamp-dot ${s.action}"></span>`;
      const timeInput = `<input class="stamp-time-input" type="time" value="${s.time}" data-id="${s.id}">`;
      const badge = `<span class="stamp-badge ${s.action}">${actionLabel}</span>`;
      const task = s.taskName ? `<span class="stamp-task">${s.taskName}</span>` : "";
      const del = `<button class="stamp-delete" data-id="${s.id}" title="Löschen">×</button>`;
      return `<div class="stamp-row">${dot}${timeInput}${badge}${task}${del}</div>`;
    }).join("");

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

  function renderAbsenceButtons() {
    const cfg = TimeRecSync.getConfig();
    const schedule = cfg ? cfg.workSchedule : null;
    const key = TimeRecCalc.weekdayKey(currentDate);
    const sollMin = schedule ? TimeRecCalc.parseTime(schedule[key] || "00:00") : 0;
    if (!sollMin) return; // Wochenende: keine Abwesenheits-Buttons

    const container = document.getElementById("history-absence");
    container.style.display = "";
    // Buttons sind im HTML bereits definiert, nur Events setzen
    document.getElementById("btn-urlaub").onclick = () => applyAbsence("Urlaub", sollMin);
    document.getElementById("btn-feiertag").onclick = () => applyAbsence("Feiertag", sollMin);
    document.getElementById("btn-kompensation").onclick = () => applyAbsence("Kompensation", sollMin);
  }

  async function applyAbsence(type, sollMin) {
    if (!confirm(`Alle Einträge für diesen Tag löschen und "${type}" eintragen?`)) return;

    // Bestehende Stempel löschen
    for (const s of stamps) {
      await TimeRecSync.deleteStamp(s.id);
    }

    // Neue Stempel: in=08:00, out=08:00+sollMin
    const startTime = "08:00";
    const endTime = TimeRecCalc.addMinutes(startTime, sollMin);
    const inStamp = await TimeRecSync.createStamp(currentDate, startTime, "in", 0, type, "");
    const outStamp = await TimeRecSync.createStamp(currentDate, endTime, "out", 0, type, "");
    stamps = [inStamp, outStamp];

    render();
    TimeRecUI.showToast(`${type} eingetragen ✓`, "success");
  }

  // Notiz speichern (debounced)
  let noteTimeout = null;
  function setupNoteSave() {
    document.getElementById("history-note").addEventListener("input", (e) => {
      clearTimeout(noteTimeout);
      noteTimeout = setTimeout(async () => {
        const text = e.target.value;
        await TimeRecAPI.saveNote(currentDate, text, noteRecord ? noteRecord.id : null);
        if (!noteRecord) {
          noteRecord = { id: null, text }; // wird beim nächsten render aktualisiert
        }
      }, 1000);
    });
  }

  // Init nur einmal aufrufen für Events
  let eventsSetup = false;
  const _init = init;
  function initOnce() {
    _init();
    if (!eventsSetup) {
      setupNoteSave();
      eventsSetup = true;
    }
  }

  return { init: initOnce };

})();
