// ============================================================
//  TIMEREC — UI / NAVIGATION
// ============================================================

const TimeRecUI = (() => {

  const PAGES = ["today", "week", "month", "history", "settings"];
  let currentPage = "today";
  let pollInterval = null;

  // ── TOAST ────────────────────────────────────────────────

  function showToast(msg, type = "success") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = `toast toast-${type} show`;
    setTimeout(() => el.classList.remove("show"), 3000);
  }

  function showError(msg) {
    const el = document.getElementById("error-screen");
    el.textContent = msg;
    el.style.display = "flex";
  }

  // ── NAVIGATION ───────────────────────────────────────────

  function navigate(page) {
    if (!PAGES.includes(page)) return;

    // Vorherige Seite deaktivieren
    if (currentPage === "today" && typeof PageToday !== "undefined") {
      PageToday.destroy && PageToday.destroy();
    }

    currentPage = page;

    // Alle Pages ausblenden
    PAGES.forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.style.display = "none";
    });

    // Aktive Page einblenden
    const active = document.getElementById(`page-${page}`);
    if (active) active.style.display = "";

    // Nav-Tabs aktualisieren
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.page === page);
    });

    // Page initialisieren
    switch (page) {
      case "today":    PageToday.init(); break;
      case "week":     PageWeek.init(); break;
      case "month":    PageMonth.init(); break;
      case "history":  PageHistory.init(); break;
      case "settings": PageSettings.init(); break;
    }

    // URL-Hash aktualisieren (für Reload-Persistenz)
    location.hash = page;
  }

  function reload() {
    navigate(currentPage);
  }

  // ── POLLING ──────────────────────────────────────────────

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(() => {
      // Nur auf der Heute-Seite neu laden (live updates)
      if (currentPage === "today" && typeof PageToday !== "undefined") {
        // PageToday hat eigenen Tick-Interval für Live-Anzeige
      }
    }, CONFIG.POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollInterval) clearInterval(pollInterval);
  }

  // ── OFFLINE-INDICATOR ────────────────────────────────────

  function updateOfflineIndicator() {
    const el = document.getElementById("offline-indicator");
    const pending = TimeRecSync.getPendingCount();
    if (!TimeRecSync.getIsOnline()) {
      el.textContent = "Offline";
      el.style.display = "";
      el.className = "offline-indicator offline";
    } else if (pending > 0) {
      el.textContent = `${pending} ausstehend`;
      el.style.display = "";
      el.className = "offline-indicator pending";
    } else {
      el.style.display = "none";
    }
  }

  setInterval(updateOfflineIndicator, 5000);

  // ── INIT ─────────────────────────────────────────────────

  async function init() {
    // Nav-Events
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.addEventListener("click", () => navigate(tab.dataset.page));
    });

    // Modals schliessen bei Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
      }
    });

    // App initialisieren
    try {
      await TimeRecSync.init();
    } catch (e) {
      return; // showError wurde bereits aufgerufen
    }

    // Startseite: aus Hash oder "today"
    const hash = location.hash.replace("#", "");
    const startPage = PAGES.includes(hash) ? hash : "today";

    document.getElementById("loading-screen").style.display = "none";
    document.getElementById("app").style.display = "";

    navigate(startPage);
    startPolling();
  }

  return { init, navigate, reload, showToast, showError };

})();

// App starten
document.addEventListener("DOMContentLoaded", () => TimeRecUI.init());
