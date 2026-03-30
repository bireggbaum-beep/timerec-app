// ============================================================
//  TIMEREC — KONFIGURATION
//  Trage hier deinen Airtable Personal Access Token ein.
// ============================================================

const CONFIG = {

  // !! HIER DEINEN TOKEN EINTRAGEN !!
  // Erstellen unter: https://airtable.com/create/tokens
  AIRTABLE_TOKEN: "pat2UGh0tHj3qjh8G.337c4344ef1b7d9c0fba2174af4b0cfcd058b7a18a2ba844ba58bf39a8cddd8a",

  // Base ID — bereits eingetragen
  AIRTABLE_BASE_ID: "appAGoHqFlrTsn5Rl",

  // Tabellennamen — müssen exakt mit Airtable übereinstimmen
  TABLES: {
    STAMPS:          "stamps",
    TASKS:           "tasks",
    CONFIG:          "config",
    BREAK_TEMPLATES: "breaktemplates"
  },

  // Wie oft die App Daten neu lädt (Millisekunden)
  POLL_INTERVAL: 30000, // 30 Sekunden

};
