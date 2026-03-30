// ============================================================
//  TIMEREC — OFFLINE SYNC
// ============================================================

const TimeRecSync = (() => {

  const QUEUE_KEY = "timerec_offline_queue";
  let isOnline = navigator.onLine;

  // App-State (wird von ui.js befüllt/gelesen)
  let appConfig = null;
  let appTasks = [];
  let appBreakTemplates = [];

  // ── ONLINE/OFFLINE EVENTS ────────────────────────────────

  window.addEventListener("online", async () => {
    isOnline = true;
    TimeRecUI.showToast("Verbindung wiederhergestellt", "success");
    await flushQueue();
    TimeRecUI.reload();
  });

  window.addEventListener("offline", () => {
    isOnline = false;
    TimeRecUI.showToast("Offline — Einträge werden lokal gespeichert", "warn");
  });

  // ── OFFLINE QUEUE ────────────────────────────────────────

  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch { return []; }
  }

  function saveQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  function enqueue(op) {
    const q = getQueue();
    q.push({ ...op, ts: Date.now() });
    saveQueue(q);
  }

  async function flushQueue() {
    const q = getQueue();
    if (!q.length) return;
    const failed = [];
    for (const op of q) {
      try {
        await executeOp(op);
      } catch (e) {
        console.warn("Sync fehler:", e, op);
        failed.push(op);
      }
    }
    saveQueue(failed);
    if (q.length - failed.length > 0) {
      TimeRecUI.showToast(`${q.length - failed.length} Einträge synchronisiert`, "success");
    }
  }

  async function executeOp(op) {
    switch (op.type) {
      case "createStamp":
        return TimeRecAPI.createStamp(op.date, op.time, op.action, op.taskId, op.taskName, op.comment);
      case "updateStamp":
        return TimeRecAPI.updateStamp(op.recordId, op.fields);
      case "deleteStamp":
        return TimeRecAPI.deleteStamp(op.recordId);
      default:
        throw new Error(`Unbekannte Op: ${op.type}`);
    }
  }

  // ── STEMPEL MIT OFFLINE-FALLBACK ─────────────────────────

  async function createStamp(date, time, action, taskId = 0, taskName = "", comment = "") {
    if (isOnline) {
      const rec = await TimeRecAPI.createStamp(date, time, action, taskId, taskName, comment);
      return { id: rec.id, date, time, action, taskId, taskName, comment };
    } else {
      const tempId = "offline_" + Date.now();
      enqueue({ type: "createStamp", date, time, action, taskId, taskName, comment });
      return { id: tempId, date, time, action, taskId, taskName, comment, offline: true };
    }
  }

  async function updateStamp(recordId, fields) {
    if (recordId.startsWith("offline_") || !isOnline) {
      enqueue({ type: "updateStamp", recordId, fields });
      return { id: recordId, fields };
    }
    return TimeRecAPI.updateStamp(recordId, fields);
  }

  async function deleteStamp(recordId) {
    if (recordId.startsWith("offline_") || !isOnline) {
      enqueue({ type: "deleteStamp", recordId });
      return;
    }
    return TimeRecAPI.deleteStamp(recordId);
  }

  // ── INIT: CONFIG + TASKS + TEMPLATES LADEN ───────────────

  async function init() {
    try {
      [appConfig, appTasks, appBreakTemplates] = await Promise.all([
        TimeRecAPI.getConfig(),
        TimeRecAPI.getTasks(),
        TimeRecAPI.getBreakTemplates()
      ]);
    } catch (e) {
      console.error("Init Fehler:", e);
      TimeRecUI.showError("Verbindung zu Airtable fehlgeschlagen. Bitte Token in config.js prüfen.");
      throw e;
    }
    return { config: appConfig, tasks: appTasks, breakTemplates: appBreakTemplates };
  }

  function getConfig() { return appConfig; }
  function getTasks() { return appTasks; }
  function getBreakTemplates() { return appBreakTemplates; }
  function getIsOnline() { return isOnline; }
  function getPendingCount() { return getQueue().length; }

  return {
    init,
    createStamp,
    updateStamp,
    deleteStamp,
    flushQueue,
    getConfig,
    getTasks,
    getBreakTemplates,
    getIsOnline,
    getPendingCount
  };

})();
