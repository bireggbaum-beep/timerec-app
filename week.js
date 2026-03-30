// ============================================================
//  TIMEREC — SEITE: WOCHE
// ============================================================

const PageWeek = (() => {

  let currentYear, currentWeek;

  function init() {
    const now = TimeRecCalc.isoWeek(TimeRecCalc.today());
    currentYear = now.year;
    currentWeek = now.week;
    render();

    document.getElementById("week-prev").addEventListener("click", () => navigate(-1));
    document.getElementById("week-next").addEventListener("click", () => navigate(1));
    document.getElementById("week-today-link").addEventListener("click", () => {
      const now = TimeRecCalc.isoWeek(TimeRecCalc.today());
      currentYear = now.year;
      currentWeek = now.week;
      render();
    });
  }

  function navigate(dir) {
    // Eine Woche vor/zurück
    let week = currentWeek + dir;
    let year = currentYear;
    if (week < 1) {
      year--;
      // Letzte KW des Vorjahres
      week = getMaxWeek(year);
    } else if (week > getMaxWeek(year)) {
      year++;
      week = 1;
    }
    currentWeek = week;
    currentYear = year;
    render();
  }

  function getMaxWeek(year) {
    // Letzte KW eines Jahres (entweder 52 oder 53)
    const dec28 = new Date(Date.UTC(year, 11, 28));
    return TimeRecCalc.isoWeek(TimeRecCalc.dateToISO(dec28)).week;
  }

  async function render() {
    const cfg = TimeRecSync.getConfig();
    const decimal = cfg ? cfg.decimalTime : false;
    const todayISO = TimeRecCalc.today();

    // Titel
    const now = TimeRecCalc.isoWeek(todayISO);
    const isCurrentWeek = currentYear === now.year && currentWeek === now.week;
    document.getElementById("week-title").textContent = `KW ${currentWeek} · ${currentYear}`;
    document.getElementById("week-today-link").style.display = isCurrentWeek ? "none" : "";

    // Stamps laden
    const days = TimeRecCalc.daysOfWeek(currentYear, currentWeek);
    const from = days[0];
    const to = days[6];
    let stamps = [];
    try {
      stamps = await TimeRecAPI.getStampsForDateRange(from, to);
    } catch (e) {
      TimeRecUI.showToast("Fehler beim Laden", "error");
    }
    const byDate = TimeRecCalc.groupByDate(stamps);

    const wc = TimeRecCalc.calcWeek(
      byDate,
      cfg ? cfg.workSchedule : null,
      cfg ? cfg.autoBreaks : null,
      currentYear,
      currentWeek
    );

    // Tabelle
    const tbody = document.getElementById("week-tbody");
    tbody.innerHTML = wc.rows.map(row => {
      const isToday = row.date === todayISO;
      const isWeekend = TimeRecCalc.isWeekend(row.date);
      const cls = isToday ? "row-today" : isWeekend ? "row-weekend" : "";
      const ist = TimeRecCalc.formatDuration(row.nettoMin, decimal);
      const soll = row.sollMin > 0 ? TimeRecCalc.formatDuration(row.sollMin, decimal) : "—";
      const delta = row.sollMin > 0
        ? `<span class="${row.deltaMin >= 0 ? "pos" : "neg"}">${row.deltaMin >= 0 ? "+" : ""}${TimeRecCalc.formatDuration(row.deltaMin, decimal)}</span>`
        : "—";
      return `<tr class="${cls}">
        <td>${TimeRecCalc.formatWeekdayShort(row.date)} ${TimeRecCalc.formatDateShort(row.date)}</td>
        <td>${ist}</td>
        <td>${soll}</td>
        <td>${delta}</td>
      </tr>`;
    }).join("");

    // Total-Zeile
    document.getElementById("week-total").innerHTML = `
      <td><strong>Total</strong></td>
      <td><strong>${TimeRecCalc.formatDuration(wc.totalNettoMin, decimal)}</strong></td>
      <td><strong>${TimeRecCalc.formatDuration(wc.totalSollMin, decimal)}</strong></td>
      <td><strong><span class="${wc.totalDeltaMin >= 0 ? "pos" : "neg"}">${wc.totalDeltaMin >= 0 ? "+" : ""}${TimeRecCalc.formatDuration(wc.totalDeltaMin, decimal)}</span></strong></td>
    `;
  }

  return { init };

})();
