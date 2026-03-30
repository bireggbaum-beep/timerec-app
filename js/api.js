// ============================================================
//  TIMEREC — AIRTABLE API
// ============================================================

const TimeRecAPI = (() => {

  const BASE_URL = "https://api.airtable.com/v0";

  function headers() {
    return {
      "Authorization": `Bearer ${CONFIG.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json"
    };
  }

  function url(table, params = "") {
    return `${BASE_URL}/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}${params}`;
  }

  async function request(method, table, body = null, params = "") {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url(table, params), opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Airtable ${method} ${table}: ${res.status} ${err.error?.message || ""}`);
    }
    return res.json();
  }

  // Alle Records einer Tabelle laden (paginiert)
  async function listAll(table, filterFormula = "") {
    let records = [];
    let offset = null;
    do {
      let params = "?pageSize=100";
      if (filterFormula) params += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
      if (offset) params += `&offset=${offset}`;
      const data = await request("GET", table, null, params);
      records = records.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);
    return records;
  }

  // Record erstellen
  async function create(table, fields) {
    const data = await request("POST", table, { fields });
    return data;
  }

  // Record aktualisieren
  async function update(table, recordId, fields) {
    const data = await request("PATCH", table, { fields }, `/${recordId}`);
    return data;
  }

  // Record löschen
  async function remove(table, recordId) {
    return request("DELETE", table, null, `/${recordId}`);
  }

  // ── STAMPS ──────────────────────────────────────────────

  async function getStampsForDate(date) {
    const records = await listAll(
      CONFIG.TABLES.STAMPS,
      `{date}="${date}"`
    );
    return records.map(r => ({ id: r.id, ...r.fields }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  async function getStampsForDateRange(from, to) {
    // Airtable formel: AND({date}>="from", {date}<="to")
    const formula = `AND({date}>="${from}",{date}<="${to}")`;
    const records = await listAll(CONFIG.TABLES.STAMPS, formula);
    return records.map(r => ({ id: r.id, ...r.fields }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  }

  async function createStamp(date, time, action, taskId = 0, taskName = "", comment = "") {
    return create(CONFIG.TABLES.STAMPS, { date, time, action, taskId, taskName, comment });
  }

  async function updateStamp(recordId, fields) {
    return update(CONFIG.TABLES.STAMPS, recordId, fields);
  }

  async function deleteStamp(recordId) {
    return remove(CONFIG.TABLES.STAMPS, recordId);
  }

  // ── TASKS ────────────────────────────────────────────────

  async function getTasks() {
    const records = await listAll(CONFIG.TABLES.TASKS);
    return records.map(r => ({ id: r.id, ...r.fields }))
      .sort((a, b) => (a.sortNr || 0) - (b.sortNr || 0));
  }

  async function createTask(name, sortNr = 0) {
    return create(CONFIG.TABLES.TASKS, { name, sortNr, inactive: false, targetOff: false, timeSumOff: false });
  }

  async function updateTask(recordId, fields) {
    return update(CONFIG.TABLES.TASKS, recordId, fields);
  }

  async function deleteTask(recordId) {
    return remove(CONFIG.TABLES.TASKS, recordId);
  }

  // ── CONFIG ───────────────────────────────────────────────

  async function getConfig() {
    const records = await listAll(CONFIG.TABLES.CONFIG, `{key}="main"`);
    if (!records.length) return null;
    const r = records[0];
    return {
      id: r.id,
      workSchedule: JSON.parse(r.fields.workSchedule || "{}"),
      autoPunchOut: JSON.parse(r.fields.autoPunchOut || "{}"),
      autoBreaks: JSON.parse(r.fields.autoBreaks || "{}"),
      decimalTime: r.fields.decimalTime || false
    };
  }

  async function saveConfig(recordId, workSchedule, autoPunchOut, autoBreaks, decimalTime) {
    return update(CONFIG.TABLES.CONFIG, recordId, {
      workSchedule: JSON.stringify(workSchedule),
      autoPunchOut: JSON.stringify(autoPunchOut),
      autoBreaks: JSON.stringify(autoBreaks),
      decimalTime
    });
  }

  // ── BREAK TEMPLATES ──────────────────────────────────────

  async function getBreakTemplates() {
    const records = await listAll(CONFIG.TABLES.BREAK_TEMPLATES);
    return records.map(r => ({ id: r.id, ...r.fields }))
      .sort((a, b) => (a.sortNr || 0) - (b.sortNr || 0));
  }

  async function createBreakTemplate(fields) {
    return create(CONFIG.TABLES.BREAK_TEMPLATES, fields);
  }

  async function updateBreakTemplate(recordId, fields) {
    return update(CONFIG.TABLES.BREAK_TEMPLATES, recordId, fields);
  }

  async function deleteBreakTemplate(recordId) {
    return remove(CONFIG.TABLES.BREAK_TEMPLATES, recordId);
  }

  // ── NOTES (in Config-Tabelle als separate Keys) ──────────
  // Notizen werden als Config-Records mit key="note:YYYY-MM-DD" gespeichert

  async function getNote(date) {
    const records = await listAll(CONFIG.TABLES.CONFIG, `{key}="note:${date}"`);
    if (!records.length) return null;
    return { id: records[0].id, text: records[0].fields.workSchedule || "" };
  }

  async function saveNote(date, text, existingId = null) {
    if (existingId) {
      return update(CONFIG.TABLES.CONFIG, existingId, { workSchedule: text });
    } else {
      return create(CONFIG.TABLES.CONFIG, { key: `note:${date}`, workSchedule: text });
    }
  }

  return {
    getStampsForDate,
    getStampsForDateRange,
    createStamp,
    updateStamp,
    deleteStamp,
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    getConfig,
    saveConfig,
    getBreakTemplates,
    createBreakTemplate,
    updateBreakTemplate,
    deleteBreakTemplate,
    getNote,
    saveNote
  };

})();
