// ============================================================
//  TIMEREC — SEITE: MONAT
// ============================================================

const PageMonth = (() => {

  let currentYear, currentMonth;

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth() + 1;
    render();

    document.getElementById("month-prev").addEventListener("click", () => navigate(-1));
    document.getElementById("month-next").addEventListener("click", () => navigate(1));
    document.getElementById("month-today-link").addEventListener("click", () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth() + 1;
      render();
    });
  }

  function navigate(dir) {
    currentMonth += dir;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    render();
  }

  async function render() {
    const cfg = TimeRecSync.getConfig();
    const decimal = cfg ? cfg.decimalTime : false;
    const now = new Date();
    const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);

    document.getElementById("month-title").textContent =
      `${TimeRecCalc.MONTH_DE[currentMonth - 1]} ${currentYear}`;
    document.getElementById("month-today-link").style.display = isCurrentMonth ? "none" : "";

    // Stamps für den ganzen Monat laden
    const from = `${currentYear}-${String(currentMonth).padStart(2,"0")}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const to = `${currentYear}-${String(currentMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;

    let stamps = [];
    try {
      stamps = await TimeRecAPI.getStampsForDateRange(from, to);
    } catch (e) {
      TimeRecUI.showToast("Fehler beim Laden", "error");
    }
    const byDate = TimeRecCalc.groupByDate(stamps);

    const mc = TimeRecCalc.calcMonth(
      byDate,
      cfg ? cfg.workSchedule : null,
      cfg ? cfg.autoBreaks : null,
      currentYear,
      currentMonth
    );

    const tbody = document.getElementById("month-tbody");
    tbody.innerHTML = mc.rows.map(row => {
      const ist = TimeRecCalc.formatDuration(row.totalNettoMin, decimal);
      const soll = row.totalSollMin > 0 ? TimeRecCalc.formatDuration(row.totalSollMin, decimal) : "—";
      const delta = row.totalSollMin > 0
        ? `<span class="${row.totalDeltaMin >= 0 ? "pos" : "neg"}">${row.totalDeltaMin >= 0 ? "+" : ""}${TimeRecCalc.formatDuration(row.totalDeltaMin, decimal)}</span>`
        : "—";
      return `<tr>
        <td>KW ${row.week}</td>
        <td class="date-range">${TimeRecCalc.formatDateShort(row.from)}–${TimeRecCalc.formatDateShort(row.to)}</td>
        <td>${ist}</td>
        <td>${soll}</td>
        <td>${delta}</td>
      </tr>`;
    }).join("");

    document.getElementById("month-total").innerHTML = `
      <td colspan="2"><strong>Total</strong></td>
      <td><strong>${TimeRecCalc.formatDuration(mc.totalNettoMin, decimal)}</strong></td>
      <td><strong>${TimeRecCalc.formatDuration(mc.totalSollMin, decimal)}</strong></td>
      <td><strong><span class="${mc.totalDeltaMin >= 0 ? "pos" : "neg"}">${mc.totalDeltaMin >= 0 ? "+" : ""}${TimeRecCalc.formatDuration(mc.totalDeltaMin, decimal)}</span></strong></td>
    `;
  }

  return { init };

})();
