// ============================================================
//  TIMEREC — KONFIGURATION
//  Trage hier deinen Airtable Personal Access Token ein.
// ============================================================

const CONFIG = {

  // !! HIER DEINEN TOKEN EINTRAGEN !!
  // Erstellen unter: https://airtable.com/create/tokens
  AIRTABLE_TOKEN: "DEIN_PERSONAL_ACCESS_TOKEN_HIER",

  // Base ID — bereits eingetragen
  AIRTABLE_BASE_ID: "appAGoHqFlrTsn5Rl",

  // Tabellennamen — müssen exakt mit Airtable übereinstimmen
  TABLES: {
    STAMPS:          "Stamps",
    TASKS:           "Tasks",
    CONFIG:          "Config",
    BREAK_TEMPLATES: "BreakTemplates"
  },

  // Wie oft die App Daten neu lädt (Millisekunden)
  POLL_INTERVAL: 30000, // 30 Sekunden

};
