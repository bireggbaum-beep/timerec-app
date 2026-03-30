// ============================================================
//  TIMEREC — BERECHNUNGSLOGIK
// ============================================================

const TimeRecCalc = (() => {

  // ── ZEITFORMATE ─────────────────────────────────────────

  // "08:15" → Minuten (495)
  function parseTime(hhmm) {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + (m || 0);
  }

  // Minuten → "08:15" (auch negativ: "-00:45")
  function formatHHMM(minutes) {
    const neg = minutes < 0;
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return (neg ? "-" : "") + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  // Minuten → "8.25" (auch negativ: "-0.75")
  function formatDecimal(minutes) {
    const neg = minutes < 0;
    const val = Math.abs(minutes) / 60;
    return (neg ? "-" : "") + val.toFixed(2);
  }

  // Minuten formatieren je nach Einstellung
  function formatDuration(minutes, decimal = false) {
    if (decimal) return formatDecimal(minutes);
    return formatHHMM(minutes);
  }

  // Aktuelles Datum als "YYYY-MM-DD"
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  // Aktuelle Zeit als "HH:MM"
  function nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // Zeit addieren: "08:00" + 15min → "08:15"
  function addMinutes(hhmm, minutes) {
    const total = parseTime(hhmm) + minutes;
    return formatHHMM(Math.max(0, total));
  }

  // Datum-Objekt → "YYYY-MM-DD"
  function dateToISO(d) {
    return d.toISOString().slice(0, 10);
  }

  // "YYYY-MM-DD" → Date-Objekt (local)
  function isoToDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // Wochentag-Name (0=So, 1=Mo, ...) → Config-Key
  const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  function weekdayKey(iso) {
    return WEEKDAY_KEYS[isoToDate(iso).getDay()];
  }

  // ISO-Wochennummer (1–53) und Jahr
  function isoWeek(d) {
    const date = typeof d === "string" ? isoToDate(d) : d;
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return { week, year: tmp.getUTCFullYear() };
  }

  // Montag der ISO-Woche
  function mondayOfWeek(year, week) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
    return dateToISO(monday);
  }

  // Alle Tage einer Woche (Mo–So) als ISO-Strings
  function daysOfWeek(year, week) {
    const mon = isoToDate(mondayOfWeek(year, week));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return dateToISO(d);
    });
  }

  // Alle KWs eines Monats
  function weeksOfMonth(year, month) {
    const weeks = [];
    const seen = new Set();
    const days = new Date(year, month, 0).getDate(); // Tage im Monat
    for (let d = 1; d <= days; d++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const { week, year: wy } = isoWeek(iso);
      const key = `${wy}-${week}`;
      if (!seen.has(key)) {
        seen.add(key);
        weeks.push({ week, year: wy });
      }
    }
    return weeks;
  }

  // ── TAGESBERECHNUNG ──────────────────────────────────────

  function calcDay(stamps, workSchedule, autoBreaks, date) {
    // Stempel chronologisch
    const sorted = [...stamps].sort((a, b) => a.time.localeCompare(b.time));

    // Paare bilden: in→out
    let pairs = [];
    let openIn = null;
    for (const s of sorted) {
      if (s.action === "in") {
        openIn = s;
      } else if (s.action === "out" && openIn) {
        pairs.push({ in: openIn, out: s });
        openIn = null;
      }
    }

    // Offene Session: bis jetzt
    let openSession = null;
    if (openIn) {
      openSession = openIn;
    }

    // Brutto-Arbeitszeit
    let bruttoMin = 0;
    for (const p of pairs) {
      bruttoMin += parseTime(p.out.time) - parseTime(p.in.time);
    }

    // Laufende offene Session dazuzählen
    if (openSession && date === today()) {
      bruttoMin += parseTime(nowTime()) - parseTime(openSession.time);
    }

    // Auto-Pause (höchste zutreffende Regel)
    let pauseMin = 0;
    if (autoBreaks && autoBreaks.enabled && autoBreaks.rules) {
      const rules = [...autoBreaks.rules].sort((a, b) => a.threshold - b.threshold);
      for (const rule of rules) {
        if (bruttoMin >= rule.threshold) {
          pauseMin = rule.break;
        }
      }
    }

    const nettoMin = Math.max(0, bruttoMin - pauseMin);

    // Soll-Zeit
    const key = weekdayKey(date);
    const sollStr = workSchedule ? (workSchedule[key] || "00:00") : "00:00";
    const sollMin = parseTime(sollStr);

    const deltaMin = nettoMin - sollMin;

    return {
      bruttoMin,
      pauseMin,
      nettoMin,
      sollMin,
      deltaMin,
      isOpen: !!openSession,
      openSince: openSession ? openSession.time : null,
      pairs,
      openSession
    };
  }

  // ── WOCHENBERECHNUNG ─────────────────────────────────────

  function calcWeek(stampsByDate, workSchedule, autoBreaks, year, week) {
    const days = daysOfWeek(year, week);
    let totalNetto = 0, totalSoll = 0;
    const rows = days.map(date => {
      const stamps = stampsByDate[date] || [];
      const dc = calcDay(stamps, workSchedule, autoBreaks, date);
      totalNetto += dc.nettoMin;
      totalSoll += dc.sollMin;
      return { date, ...dc };
    });
    return {
      rows,
      totalNettoMin: totalNetto,
      totalSollMin: totalSoll,
      totalDeltaMin: totalNetto - totalSoll
    };
  }

  // ── MONATSBERECHNUNG ─────────────────────────────────────

  function calcMonth(stampsByDate, workSchedule, autoBreaks, year, month) {
    const weeks = weeksOfMonth(year, month);
    let totalNetto = 0, totalSoll = 0;
    const rows = weeks.map(({ week, year: wy }) => {
      const wc = calcWeek(stampsByDate, workSchedule, autoBreaks, wy, week);
      totalNetto += wc.totalNettoMin;
      totalSoll += wc.totalSollMin;
      // Datumsbereich der KW im Monat
      const days = daysOfWeek(wy, week);
      const from = days[0];
      const to = days[6];
      return { week, year: wy, from, to, ...wc };
    });
    return {
      rows,
      totalNettoMin: totalNetto,
      totalSollMin: totalSoll,
      totalDeltaMin: totalNetto - totalSoll
    };
  }

  // ── STAMPS ZU MAP ────────────────────────────────────────

  function groupByDate(stamps) {
    const map = {};
    for (const s of stamps) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }

  // ── PAUSENVORLAGEN ───────────────────────────────────────

  // Gibt {outTime, inTime} zurück basierend auf Vorlage-Typ
  function calcBreakTimes(template) {
    const now = nowTime();
    if (template.type === "fixed") {
      return { outTime: template.startTime, inTime: template.endTime };
    } else if (template.type === "next") {
      return { outTime: now, inTime: addMinutes(now, template.durationMinutes) };
    } else if (template.type === "last") {
      return { outTime: addMinutes(now, -template.durationMinutes), inTime: now };
    }
    return null;
  }

  // ── DATUMSFORMATIERUNG ───────────────────────────────────

  const WEEKDAY_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const MONTH_DE = ["Januar","Februar","März","April","Mai","Juni",
                    "Juli","August","September","Oktober","November","Dezember"];

  function formatDateLong(iso) {
    const d = isoToDate(iso);
    return `${["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"][d.getDay()]}, ${d.getDate()}. ${MONTH_DE[d.getMonth()]}`;
  }

  function formatDateShort(iso) {
    const d = isoToDate(iso);
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.`;
  }

  function formatWeekdayShort(iso) {
    return WEEKDAY_DE[isoToDate(iso).getDay()];
  }

  function isWeekend(iso) {
    const day = isoToDate(iso).getDay();
    return day === 0 || day === 6;
  }

  return {
    parseTime,
    formatHHMM,
    formatDecimal,
    formatDuration,
    today,
    nowTime,
    addMinutes,
    dateToISO,
    isoToDate,
    weekdayKey,
    isoWeek,
    mondayOfWeek,
    daysOfWeek,
    weeksOfMonth,
    calcDay,
    calcWeek,
    calcMonth,
    groupByDate,
    calcBreakTimes,
    formatDateLong,
    formatDateShort,
    formatWeekdayShort,
    isWeekend,
    MONTH_DE,
    WEEKDAY_DE
  };

})();
