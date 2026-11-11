/*
 * Foyer Malin — panneau Home Assistant.
 * Un seul fichier, sans dépendance ni étape de build.
 * Les couleurs viennent du thème de Home Assistant (clair ou sombre).
 */

const FOYER_VERSION = "0.3.0";

/* ------------------------------------------------------------------ outils */

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (iso, n) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const mondayOf = (iso) => addDays(iso, -((parseIso(iso).getDay() + 6) % 7));
const todayIso = () => isoDate(new Date());
const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);
const fmtDay = (iso, opts = { weekday: "long", day: "numeric", month: "long" }) =>
  parseIso(iso).toLocaleDateString("fr-FR", opts);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const clone = (o) => JSON.parse(JSON.stringify(o));
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : "#888888");
const icon = (name) => `<ha-icon icon="mdi:${name}"></ha-icon>`;
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

/* « Aujourd'hui », « Demain », « Hier », « Mardi », sinon « mar. 17 nov. ». */
function dayLabel(iso, today = todayIso()) {
  const delta = daysBetween(today, iso);
  if (delta === 0) return "Aujourd'hui";
  if (delta === 1) return "Demain";
  if (delta === -1) return "Hier";
  if (delta > 1 && delta < 7) return cap(fmtDay(iso, { weekday: "long" }));
  return fmtDay(iso, { weekday: "short", day: "numeric", month: "short" });
}

const FREQ_LABELS = { none: "Une seule fois", daily: "Tous les jours", weekly: "Toutes les semaines", monthly: "Tous les mois", yearly: "Tous les ans" };
const FREQ_UNITS = { daily: ["jour", "jours"], weekly: ["semaine", "semaines"], monthly: ["mois", "mois"], yearly: ["an", "ans"] };

function recurrenceLabel(rec) {
  if (!rec || rec.freq === "none") return "";
  if ((rec.interval || 1) === 1) return FREQ_LABELS[rec.freq];
  // « semaine » est féminin : « Toutes les 2 semaines », mais « Tous les 3 jours ».
  return `${rec.freq === "weekly" ? "Toutes" : "Tous"} les ${rec.interval} ${FREQ_UNITS[rec.freq][1]}`;
}

/* Heure d'un événement : « 17:00 – 18:00 », « Journée », « Jusqu'au 16 nov. ». */
function eventTime(ev) {
  if (ev.all_day) {
    return ev.end > ev.start ? `Jusqu'au ${fmtDay(ev.end, { day: "numeric", month: "short" })}` : "Journée";
  }
  const sameDay = ev.start.slice(0, 10) === ev.end.slice(0, 10);
  return `${ev.start.slice(11, 16)} – ${sameDay ? "" : fmtDay(ev.end, { day: "numeric", month: "short" }) + " "}${ev.end.slice(11, 16)}`;
}

const MEMBER_EMOJIS = ["🙂", "👩", "👨", "🧑", "👧", "👦", "👶", "👵", "👴", "🦸", "🧙", "🐶", "🐱", "🦊", "🐼", "🦄"];
const LIST_EMOJIS = ["🏠", "🍀", "🐈‍⬛", "🧹", "🧺", "🧳", "🎁", "🎒", "🔧", "🚗", "💊", "📚", "🎉", "💡", "📝", "🐶"];

const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/* En retard : date passée, ou aujourd'hui à une heure déjà passée. */
const isLate = (t, today = todayIso()) =>
  !t.done && Boolean(t.due) && (t.due < today || (t.due === today && Boolean(t.time) && t.time < nowHM()));
/* « Aujourd'hui, 18:00 », « Demain », « mer. 7 oct., 08:35 ». */
const taskWhen = (t, today = todayIso()) => `${dayLabel(t.due, today)}${t.time ? `, ${t.time}` : ""}`;

/* Logo de l'app : une maison avec un cœur (même dessin que l'icône de l'intégration). */
const LOGO_SVG = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
  <rect x="2" y="2" width="60" height="60" rx="16" fill="#6e56cf"/>
  <path d="M8 18c4-7 11-11 18-12" stroke="#b7a6f5" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
  <path d="M32 12 11 30.5h6V50a3 3 0 0 0 3 3h24a3 3 0 0 0 3-3V30.5h6z" fill="#fff"/>
  <path d="M32 47C22 40 21 35 21 33a5.5 5.5 0 0 1 11-1.5A5.5 5.5 0 0 1 43 33c0 2-1 7-11 14z" fill="#ff6b8b"/>
  <path d="M50 12l1.400 3 3 1.400-3 1.400-1.400 3-1.400-3-3-1.400 3-1.400z" fill="#ffd166"/>
</svg>`;

/* ------------------------------------------------------------------ styles */

const STYLES = `
:host {
  --fm-primary: var(--primary-color, #03a9f4);
  --fm-on-primary: var(--text-primary-color, #fff);
  --fm-bg: var(--primary-background-color, #fafafa);
  --fm-card: var(--card-background-color, var(--ha-card-background, #fff));
  --fm-text: var(--primary-text-color, #212121);
  --fm-text2: var(--secondary-text-color, #727272);
  --fm-divider: var(--divider-color, rgba(0, 0, 0, 0.12));
  --fm-header-bg: var(--app-header-background-color, var(--fm-primary));
  --fm-header-text: var(--app-header-text-color, var(--fm-on-primary));
  --fm-error: var(--error-color, #db4437);
  --fm-success: var(--success-color, #43a047);
  --fm-warning: var(--warning-color, #ffa600);
  --fm-radius: var(--ha-card-border-radius, 12px);
  --fm-soft: color-mix(in srgb, var(--fm-primary) 12%, transparent);
  --fm-nav-h: 64px;
  display: block; height: 100%;
  background: var(--fm-bg); color: var(--fm-text);
  font-family: var(--paper-font-body1_-_font-family, var(--ha-font-family-body, Roboto, "Helvetica Neue", sans-serif));
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
ha-icon { --mdc-icon-size: 22px; display: inline-flex; }
button { font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
input, textarea, select { font: inherit; color: var(--fm-text); }
h2, h3, p { margin: 0; }

/* Hauteur = écran moins ce qui est au-dessus du panneau. --fm-top est mesuré en JavaScript. */
.app {
  position: relative; display: flex; flex-direction: column; overflow: hidden; overscroll-behavior: none;
  height: calc(100vh - var(--fm-top, 0px)); height: calc(100dvh - var(--fm-top, 0px));
}
.toolbar {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
  height: var(--header-height, 56px); padding: 0 8px 0 4px;
  background: var(--fm-header-bg); color: var(--fm-header-text);
  border-bottom: var(--app-header-border-bottom, none);
}
.toolbar .logo { width: 34px; height: 34px; flex-shrink: 0; }
.toolbar .title { font-size: 20px; margin-left: 10px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.05; }
.toolbar .title small { display: block; font-size: 12px; opacity: .75; letter-spacing: .02em; }
.icon-btn {
  width: 44px; height: 44px; border-radius: 50%; border: 0; background: transparent; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.icon-btn:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
.icon-btn.small { width: 36px; height: 36px; color: var(--fm-text2); }

main { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.page { max-width: 760px; margin: 0 auto; padding: 16px 16px 32px; }
nav.tabs {
  flex-shrink: 0; z-index: 5; display: flex; justify-content: center;
  background: var(--fm-card); border-top: 1px solid var(--fm-divider); padding-bottom: env(safe-area-inset-bottom);
}
nav.tabs .inner { display: flex; width: 100%; max-width: 560px; }
nav.tabs button {
  flex: 1; min-width: 0; height: var(--fm-nav-h); border: 0; background: none; color: var(--fm-text2);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 12px; font-weight: 500;
}
nav.tabs .pill { position: relative; display: inline-flex; padding: 4px 16px; border-radius: 16px; transition: background .2s; }
nav.tabs button.active { color: var(--fm-primary); }
nav.tabs button.active .pill { background: var(--fm-soft); }
.badge {
  position: absolute; top: -4px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
  background: var(--fm-error); color: #fff; font-size: 11px; font-weight: 600; line-height: 18px; text-align: center;
}

/* Blocs communs */
.card { background: var(--fm-card); border: 1px solid var(--fm-divider); border-radius: var(--fm-radius); padding: 14px 16px; margin-bottom: 12px; }
.card.flush { padding: 4px 0; }
.sec { display: flex; align-items: center; gap: 8px; margin: 22px 0 8px; }
.sec:first-child { margin-top: 0; }
.sec h3 { flex: 1; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--fm-text2); }
.sec h3.late { color: var(--fm-error); }
.hello { font-size: 24px; font-weight: 500; }
.sub { color: var(--fm-text2); font-size: 14px; }
.empty { text-align: center; color: var(--fm-text2); padding: 28px 16px; }
.empty .big { font-size: 44px; display: block; margin-bottom: 8px; }
.empty .btn { margin-top: 14px; }
.row { display: flex; align-items: center; gap: 10px; }
.row.wrap { flex-wrap: wrap; }
.grow { flex: 1; min-width: 0; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; padding: 0 18px;
  border-radius: 21px; border: 0; background: var(--fm-primary); color: var(--fm-on-primary); font-weight: 500;
}
.btn.tonal { background: var(--fm-soft); color: var(--fm-primary); }
.btn.text { background: transparent; color: var(--fm-primary); padding: 0 10px; }
.btn.danger { background: transparent; color: var(--fm-error); }
.btn.danger-fill { background: var(--fm-error); color: #fff; }
.btn[disabled] { opacity: .5; cursor: default; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips.scroll { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; margin-bottom: 12px; scrollbar-width: none; }
.chips.scroll::-webkit-scrollbar { display: none; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px; border-radius: 19px; white-space: nowrap;
  border: 1px solid var(--fm-divider); background: var(--fm-card); color: var(--fm-text); font-size: 14px;
}
.chip.on { background: var(--fm-soft); border-color: var(--fm-primary); color: var(--fm-primary); font-weight: 500; }
.input {
  width: 100%; min-height: 46px; padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--fm-divider); background: var(--fm-card); outline: none;
}
.input:focus { border-color: var(--fm-primary); box-shadow: 0 0 0 1px var(--fm-primary); }
textarea.input { resize: vertical; min-height: 80px; }
select.input { appearance: auto; }
label.field { display: block; margin-bottom: 14px; }
label.field > span, .field-label { display: block; font-size: 13px; color: var(--fm-text2); margin-bottom: 6px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.two.repeat { grid-template-columns: 1.7fr 1fr; }
.quick { display: flex; gap: 8px; margin-bottom: 14px; }
.quick .btn { padding: 0 14px; flex-shrink: 0; }

.av {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; font-size: 19px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c) 22%, var(--fm-card)); border: 2px solid var(--c);
}
.av.small { width: 24px; height: 24px; font-size: 13px; border-width: 1.5px; }
.av.big { width: 52px; height: 52px; font-size: 28px; }
.avs { display: inline-flex; }
.avs .av + .av { margin-left: -6px; }

/* Tâches */
.pts { font-size: 12px; font-weight: 600; color: var(--fm-warning); white-space: nowrap; }

/* Agenda */
.weeknav { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; }
.weeknav .label { flex: 1; text-align: center; font-weight: 500; font-size: 17px; }
.day { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--fm-divider); }
.day:first-of-type { border-top: 0; }
.day .date { width: 48px; flex-shrink: 0; text-align: center; border: 0; background: none; border-radius: 12px; padding: 4px 0; align-self: flex-start; }
.day .date .w { display: block; font-size: 12px; text-transform: uppercase; color: var(--fm-text2); }
.day .date .n { display: block; font-size: 22px; font-weight: 500; line-height: 1.2; }
.day.today .date { background: var(--fm-primary); color: var(--fm-on-primary); }
.day.today .date .w { color: inherit; opacity: .85; }
.day.past { opacity: .6; }
.day .items { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.day .none { color: var(--fm-text2); font-size: 14px; padding: 8px 0; }
.ev {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 12px;
  background: var(--fm-card); border: 1px solid var(--fm-divider); border-left: 4px solid var(--c, var(--fm-primary)); border-radius: 10px;
}
.ev .t { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev .m { font-size: 13px; color: var(--fm-text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev.todo { border-left-color: var(--fm-divider); border-style: dashed; padding: 6px 12px; }
.ev.todo ha-icon { --mdc-icon-size: 18px; color: var(--fm-text2); }

/* Listes (sommaire) */
.page.flush { padding: 0 0 96px; max-width: 760px; }
.lrows { background: var(--fm-card); border-bottom: 1px solid var(--fm-divider); }
.lrow { display: flex; align-items: center; gap: 16px; width: 100%; text-align: left; border: 0; background: none; padding: 14px 16px; border-top: 1px solid var(--fm-divider); }
.lrow:first-child { border-top: 0; }
.lrow .le { font-size: 30px; width: 40px; text-align: center; flex-shrink: 0; }
.lrow .t { font-size: 18px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lrow .m { display: flex; align-items: center; gap: 4px; font-size: 15px; color: var(--fm-text2); margin-top: 2px; }
.lrow .m ha-icon { --mdc-icon-size: 17px; }
.lrow .m .late { color: var(--fm-error); }
.count { min-width: 40px; height: 40px; padding: 0 10px; border-radius: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--fm-text) 8%, transparent); font-size: 19px; font-weight: 500; }

/* Une liste ouverte */
.lhero { position: relative; overflow: hidden; background: var(--lc); color: #fff; padding: 12px 16px 22px; min-height: 168px; display: flex; flex-direction: column; }
.lhero-top { display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; }
.round { min-width: 46px; height: 46px; padding: 0 12px; border-radius: 23px; border: 0; background: #fff; color: #222; box-shadow: 0 2px 6px rgba(0,0,0,.18);
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 17px; font-weight: 500; }
.lhero h2 { position: relative; z-index: 1; margin-top: auto; font-size: 32px; font-weight: 600; max-width: 72%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lhero-art { position: absolute; right: -6px; bottom: -14px; font-size: 104px; line-height: 1; transform: rotate(-14deg); opacity: .9; filter: saturate(.85); }
.lhero-count { position: absolute; right: 30px; bottom: 34px; width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,.45); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; }
.addrow { display: flex; align-items: center; gap: 14px; padding: 0 16px; background: var(--fm-card); border-bottom: 1px solid var(--fm-divider); }
.addrow ha-icon { --mdc-icon-size: 26px; color: var(--fm-text2); width: 44px; justify-content: center; }
.addrow input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-size: 18px; padding: 18px 0; }
.lclear { display: block; margin: 12px auto 0; }

/* Tâche (même allure partout) */
.trows { background: var(--fm-card); }
.card.flush .trows, .trows.inset { background: none; }
.trow { display: flex; align-items: center; gap: 2px; padding: 4px 16px 4px 4px; }
.tcheck { width: 52px; height: 52px; border: 0; background: none; flex-shrink: 0; color: var(--fm-text2); display: inline-flex; align-items: center; justify-content: center; }
.tcheck ha-icon { --mdc-icon-size: 30px; }
.trow.done .tcheck { color: var(--lc, var(--fm-success)); }
.tbody { flex: 1; min-width: 0; border: 0; background: none; text-align: left; padding: 8px 0; }
.tbody .t { font-size: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trow.done .t { text-decoration: line-through; color: var(--fm-text2); }
.tbody .m { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; font-size: 15px; color: var(--fm-text2); margin-top: 3px; }
.tbody .m span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.tbody .m ha-icon { --mdc-icon-size: 18px; }
.tbody .m .late { color: var(--fm-error); }
.trow .avs .av { width: 34px; height: 34px; font-size: 18px; border-width: 2px; }
.trow .avs .av + .av { margin-left: -12px; }

.fab { position: absolute; right: 18px; bottom: calc(var(--fm-nav-h) + 18px + env(safe-area-inset-bottom)); z-index: 6;
  width: 64px; height: 64px; border-radius: 50%; border: 0; background: var(--lc, var(--fm-primary)); color: #fff;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,.28); }
.fab ha-icon { --mdc-icon-size: 32px; }

/* Famille */
.member { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 8px;
  background: var(--fm-card); border: 1px solid var(--fm-divider); border-radius: var(--fm-radius); }
.member .t { font-weight: 500; font-size: 16px; }
.score { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.score .bar { flex: 1; height: 8px; border-radius: 4px; background: var(--fm-divider); overflow: hidden; }
.score .bar i { display: block; height: 100%; border-radius: 4px; background: var(--c); }
.score .n { width: 64px; text-align: right; font-weight: 600; font-size: 14px; }
.switch { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.toggle { width: 48px; height: 28px; border-radius: 14px; border: 0; background: var(--fm-divider); position: relative; flex-shrink: 0; padding: 0; }
.toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.toggle.on { background: var(--fm-primary); }
.toggle.on::after { left: 23px; }
.swatches { display: flex; flex-wrap: wrap; gap: 10px; }
.swatch { width: 38px; height: 38px; border-radius: 50%; border: 3px solid transparent; background: var(--c); padding: 0; }
.swatch.on { border-color: var(--fm-text); box-shadow: inset 0 0 0 2px var(--fm-card); }
.emojis { display: flex; flex-wrap: wrap; gap: 6px; }
.emojis button { width: 42px; height: 42px; font-size: 22px; border-radius: 10px; border: 1px solid transparent; background: none; padding: 0; }
.emojis button.on { border-color: var(--fm-primary); background: var(--fm-soft); }
.stepper { display: inline-flex; align-items: center; gap: 4px; }
.stepper b { min-width: 28px; text-align: center; font-size: 17px; }

/* Fenêtre par-dessus (édition) */
.sheet { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; background: var(--fm-bg); animation: up .2s ease-out; }
.sheet .body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.sheet .footer { flex-shrink: 0; display: flex; gap: 8px; justify-content: space-between; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--fm-divider); background: var(--fm-card); }
@keyframes up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.hint { font-size: 13px; color: var(--fm-text2); margin: -6px 0 14px; }

.toast {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--fm-nav-h) + 14px + env(safe-area-inset-bottom)); z-index: 30;
  display: flex; align-items: center; gap: 10px; max-width: calc(100% - 32px); padding: 10px 16px; border-radius: 24px;
  background: var(--fm-text); color: var(--fm-bg); box-shadow: 0 4px 16px rgba(0,0,0,.25); font-size: 14px;
}
.toast.high { bottom: calc(84px + env(safe-area-inset-bottom)); }
.toast.error { background: var(--fm-error); color: #fff; }
.toast button { border: 0; background: none; color: inherit; font-weight: 700; text-decoration: underline; padding: 4px; }
.dialog-backdrop { position: absolute; inset: 0; z-index: 40; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog { background: var(--fm-card); border-radius: 20px; padding: 22px; max-width: 380px; width: 100%; }
.dialog h3 { font-size: 19px; font-weight: 500; margin-bottom: 8px; }
.dialog p { color: var(--fm-text2); margin-bottom: 18px; }
.dialog .row { justify-content: flex-end; }
`;

/* ------------------------------------------------------------------ panneau */

class FoyerMalinPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._narrow = false;
    this.s = {
      tab: "home",
      config: null,
      data: null,
      // Événements à venir (accueil) et de la semaine affichée (agenda), répétitions dépliées.
      home: { events: [] },
      week: { start: mondayOf(todayIso()), events: [] },
      taskFilter: "all",
      showDone: false,
      listId: null,
      stack: [],
      toast: null,
    };
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    this.shadowRoot.addEventListener("input", (ev) => this._onInput(ev));
    this.shadowRoot.addEventListener("change", (ev) => this._onInput(ev, true));
    this.shadowRoot.addEventListener("keydown", (ev) => this._onKey(ev));
  }

  /* ---------------- propriétés données par Home Assistant */

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
  }
  get hass() {
    return this._hass;
  }
  set narrow(value) {
    const changed = this._narrow !== value;
    this._narrow = value;
    if (changed && this._hass) this._render();
  }
  set panel(_) {}
  set route(_) {}

  connectedCallback() {
    if (!this._hass) return;
    if (!this.shadowRoot.firstChild) this._render();
    if (this.s.config) {
      this._subscribe();
      this._listenLocation();
      this._applyRoute();
    }
  }

  disconnectedCallback() {
    this._unsubscribe();
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._onResize = null;
    }
    if (this._onLocation) {
      window.removeEventListener("location-changed", this._onLocation);
      this._onLocation = null;
    }
  }

  async _init() {
    this._render();
    try {
      this.s.config = await this._ws("config");
    } catch (err) {
      this._toast(this._err(err), true);
      return;
    }
    await this._subscribe();
    this._listenLocation();
    this._applyRoute();
  }

  /* Les données arrivent d'un coup, puis de nouveau à chaque modification faite sur n'importe quel appareil. */
  async _subscribe() {
    if (this._unsub || this._subscribing || !this.isConnected) return;
    this._subscribing = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        (data) => {
          this.s.data = data;
          if (this.s.listId && !this._list(this.s.listId)) this.s.listId = null;
          if (this.s.taskFilter !== "all" && !this._member(this.s.taskFilter)) this.s.taskFilter = "all";
          this._render();
          this._loadEvents();
        },
        { type: "foyer_malin/subscribe" }
      );
    } catch (err) {
      this._toast(this._err(err), true);
    }
    this._subscribing = false;
  }

  _unsubscribe() {
    if (this._unsub) this._unsub();
    this._unsub = null;
  }

  _listenLocation() {
    if (this._onLocation) return;
    this._onLocation = () => setTimeout(() => this._applyRoute(), 0);
    window.addEventListener("location-changed", this._onLocation);
  }

  /* Liens venus d'une notification ou de la carte : /foyer-malin?tab=tasks&member=… */
  _applyRoute() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (!["home", "agenda", "tasks", "lists", "family"].includes(tab)) return;
    this.s.tab = tab;
    if (params.get("member")) this.s.taskFilter = params.get("member");
    history.replaceState(null, "", window.location.pathname);
    this._render();
  }

  async _loadEvents() {
    const today = this.s.data.today;
    const seq = (this._eventSeq = (this._eventSeq || 0) + 1);
    try {
      const [home, week] = await Promise.all([
        this._ws("events/range", { start: today, end: addDays(today, 6) }),
        this._ws("events/range", { start: this.s.week.start, end: addDays(this.s.week.start, 6) }),
      ]);
      // Une réponse plus ancienne ne doit pas écraser une plus récente (changement de semaine rapide).
      if (seq !== this._eventSeq) return;
      this.s.home.events = home.events;
      this.s.week.events = week.events;
      if (this.s.tab === "home" || this.s.tab === "agenda") this._render();
    } catch (err) {
      this._toast(this._err(err), true);
    }
  }

  _ws(type, payload = {}) {
    return this._hass.callWS({ type: `foyer_malin/${type}`, ...payload });
  }

  /* Appel qui signale lui-même son échec. Renvoie null en cas d'erreur. */
  async _call(type, payload) {
    try {
      return await this._ws(type, payload);
    } catch (err) {
      this._toast(this._err(err), true);
      return null;
    }
  }

  _err(err) {
    return (err && (err.message || err.code)) || "Une erreur est survenue";
  }

  _toast(message, error = false, action = null) {
    clearTimeout(this._toastTimer);
    this.s.toast = { message, error, action };
    this._renderToast();
    this._toastTimer = setTimeout(() => {
      this.s.toast = null;
      this._renderToast();
    }, error ? 6000 : action ? 6000 : 3500);
  }

  /* ---------------- accès aux données */

  get top() {
    return this.s.stack[this.s.stack.length - 1];
  }
  get today() {
    return (this.s.data && this.s.data.today) || todayIso();
  }
  get members() {
    return (this.s.data && this.s.data.members) || [];
  }
  _member(id) {
    return this.members.find((m) => m.id === id);
  }
  _list(id) {
    return this.s.data.lists.find((l) => l.id === id);
  }
  _openTasks() {
    return this.s.data.tasks
      .filter((t) => !t.done)
      .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.time || "").localeCompare(b.time || "") || a.created_at.localeCompare(b.created_at));
  }
  /* Tâches à faire aujourd'hui, retards compris (pastille de l'onglet, accueil). */
  _dueTasks() {
    return this._openTasks().filter((t) => t.due && t.due <= this.today);
  }
  _listTasks(listId) {
    return this.s.data.tasks.filter((t) => t.list_id === listId);
  }
  _listColor(list) {
    return safeColor(list && list.color);
  }

  /* ---------------- champs de saisie */

  _setPath(path, value) {
    const keys = path.split(".");
    let obj = keys[0] === "top" ? this.top : this.s;
    if (keys[0] === "top") keys.shift();
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
  }

  _onInput(ev, committed = false) {
    const el = ev.target;
    if (!el.dataset || !el.dataset.path) return;
    this._setPath(el.dataset.path, el.value);
    // Certains champs changent le reste du formulaire : on le redessine une fois la saisie validée.
    if (committed && el.dataset.refresh != null) {
      if (this.top && this.top.type === "event") this._fixEventEnd(el.dataset.path);
      this._renderOverlay();
    }
  }

  _onKey(ev) {
    if (ev.key !== "Enter" || ev.isComposing) return;
    const action = ev.target.dataset && ev.target.dataset.enter;
    if (!action) return;
    ev.preventDefault();
    this._dispatch(action, ev.target);
  }

  _onClick(ev) {
    const el = ev.composedPath().find((n) => n.dataset && n.dataset.action);
    if (!el || el.disabled) return;
    ev.preventDefault();
    this._dispatch(el.dataset.action, el);
  }

  _confirm({ title, message, confirm = "Supprimer" }) {
    return new Promise((resolve) => {
      this._confirmResolve = resolve;
      this.shadowRoot.getElementById("dialog").innerHTML = `<div class="dialog-backdrop" data-action="dialog-no">
        <div class="dialog" role="alertdialog" aria-modal="true" data-action="dialog-noop">
          <h3>${esc(title)}</h3><p>${esc(message)}</p>
          <div class="row"><button class="btn text" data-action="dialog-no">Annuler</button>
          <button class="btn danger-fill" data-action="dialog-yes">${esc(confirm)}</button></div>
        </div></div>`;
    });
  }

  _closeDialog(answer) {
    this.shadowRoot.getElementById("dialog").innerHTML = "";
    if (this._confirmResolve) this._confirmResolve(answer);
    this._confirmResolve = null;
  }

  /* ---------------- actions */

  async _dispatch(action, el) {
    const d = (el && el.dataset) || {};
    const s = this.s;
    const top = this.top;
    switch (action) {
      case "menu":
        this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
        break;
      case "tab":
        s.tab = d.tab;
        if (d.tab === "lists") s.listId = null;
        this._tabChanged = true;
        this._render();
        break;
      case "dialog-yes":
        this._closeDialog(true);
        break;
      case "dialog-no":
        this._closeDialog(false);
        break;
      case "dialog-noop":
        break;
      case "close":
        s.stack.pop();
        this._renderOverlay();
        break;
      case "toast-action": {
        const act = s.toast && s.toast.action;
        s.toast = null;
        this._renderToast();
        if (act) act.run();
        break;
      }

      /* ---- tâches */
      case "task-filter":
        s.taskFilter = d.id;
        this._render();
        break;
      case "task-quick": {
        const input = this.shadowRoot.getElementById("task-quick");
        const title = input.value.trim();
        if (!title) return input.focus();
        input.value = "";
        const assignees = s.taskFilter === "all" ? [] : [s.taskFilter];
        await this._call("tasks/save", { task: { title, assignees } });
        break;
      }
      case "task-new":
        this._openTask({
          due: d.due || null,
          list_id: s.tab === "lists" ? s.listId : null,
          assignees: s.taskFilter === "all" || s.tab !== "tasks" ? [] : [s.taskFilter],
        });
        break;
      case "list-task-quick": {
        const input = this.shadowRoot.getElementById("list-quick");
        const title = input.value.trim();
        if (!title) return input.focus();
        input.value = "";
        await this._call("tasks/save", { task: { title, list_id: s.listId } });
        input.focus();
        break;
      }
      case "task-open":
        this._openTask(s.data.tasks.find((t) => t.id === d.id));
        break;
      case "task-toggle":
        await this._toggleTask(d.id);
        break;
      case "done-toggle":
        s.showDone = !s.showDone;
        this._render();
        break;
      case "done-clear": {
        const res = await this._call("tasks/clear_done");
        if (res) this._toast(`${plural(res.removed, "tâche")} effacée${res.removed > 1 ? "s" : ""}`);
        break;
      }
      case "pick": {
        // Sélection multiple (membres d'une tâche ou d'un événement).
        const list = top.draft[d.field];
        const i = list.indexOf(d.id);
        if (i >= 0) list.splice(i, 1);
        else list.push(d.id);
        this._renderOverlay();
        break;
      }
      case "set":
        top.draft[d.field] = d.value;
        this._renderOverlay();
        break;
      case "flip":
        top.draft[d.field] = !top.draft[d.field];
        if (top.type === "event") this._fixEventEnd();
        this._renderOverlay();
        break;
      case "step": {
        const next = Number(top.draft[d.field]) + Number(d.delta);
        top.draft[d.field] = Math.max(Number(d.min), Math.min(Number(d.max), next));
        this._renderOverlay();
        break;
      }
      case "task-save": {
        const f = top.draft;
        const recurrence = { freq: f.freq, interval: Number(f.interval) || 1 };
        const task = {
          id: f.id, title: f.title, notes: f.notes, assignees: f.assignees, due: f.due || null,
          time: (f.due && f.time) || null, list_id: f.list_id || null,
          recurrence, rotate: Boolean(f.rotate), points: Number(f.points),
        };
        if (await this._call("tasks/save", { task })) this._dispatch("close");
        break;
      }
      case "task-delete":
        if (await this._confirm({ title: "Supprimer la tâche ?", message: `« ${top.draft.title} » sera supprimée pour tout le monde.` })) {
          await this._call("tasks/delete", { task_id: top.draft.id });
          this._dispatch("close");
        }
        break;

      /* ---- agenda */
      case "week-prev":
      case "week-next":
      case "week-today":
        s.week.start = action === "week-today" ? mondayOf(this.today) : addDays(s.week.start, action === "week-prev" ? -7 : 7);
        s.week.events = [];
        this._render();
        this._loadEvents();
        break;
      case "event-new":
        this._openEvent({ date: d.date || this.today });
        break;
      case "event-open":
        this._openEvent(s.data.events.find((e) => e.id === d.id));
        break;
      case "event-save": {
        const f = top.draft;
        const event = {
          id: f.id, title: f.title, all_day: f.all_day, members: f.members, location: f.location, notes: f.notes,
          start: f.all_day ? f.startDate : `${f.startDate}T${f.startTime}`,
          end: f.all_day ? f.endDate : `${f.endDate}T${f.endTime}`,
          recurrence: { freq: f.freq, interval: Number(f.interval) || 1, until: f.until || null },
        };
        if (await this._call("events/save", { event })) this._dispatch("close");
        break;
      }
      case "event-delete": {
        const repeats = top.draft.freq !== "none";
        const message = repeats ? "Toutes ses répétitions seront supprimées." : "Il sera retiré de l'agenda de tout le monde.";
        if (await this._confirm({ title: `Supprimer « ${top.draft.title} » ?`, message })) {
          await this._call("events/delete", { event_id: top.draft.id });
          this._dispatch("close");
        }
        break;
      }

      /* ---- listes */
      case "list-open":
        s.listId = d.id;
        this._tabChanged = true;
        this._render();
        break;
      case "list-back":
        s.listId = null;
        this._render();
        break;
      case "list-new": {
        const colors = s.config.list_colors;
        const used = new Set(s.data.lists.map((l) => l.color));
        const color = colors.find((c) => !used.has(c)) || colors[s.data.lists.length % colors.length];
        s.stack.push({ type: "list", draft: { id: null, name: "", emoji: LIST_EMOJIS[0], color } });
        this._renderOverlay(true);
        break;
      }
      case "list-edit": {
        const list = this._list(s.listId);
        s.stack.push({ type: "list", draft: { id: list.id, name: list.name, emoji: list.emoji, color: list.color } });
        this._renderOverlay(true);
        break;
      }
      case "list-save": {
        const res = await this._call("lists/save", { list: top.draft });
        if (!res) break;
        // La liste créée s'ouvre aussitôt, même si la mise à jour générale n'est pas encore arrivée.
        if (!this._list(res.list.id)) s.data.lists.push(res.list);
        if (!top.draft.id) s.listId = res.list.id;
        this._dispatch("close");
        this._render();
        break;
      }
      case "list-delete": {
        const list = this._list(top.draft.id);
        const count = this._listTasks(list.id).length;
        const message = `« ${list.name} »${count ? ` et ses ${plural(count, "tâche")}` : ""} ${count ? "seront supprimées" : "sera supprimée"}.`;
        if (await this._confirm({ title: "Supprimer la liste ?", message })) {
          s.listId = null;
          await this._call("lists/delete", { list_id: list.id });
          this._dispatch("close");
        }
        break;
      }
      case "list-clear-done": {
        const res = await this._call("tasks/clear_done", { list_id: s.listId });
        if (res) this._toast(`${plural(res.removed, "tâche")} terminée${res.removed > 1 ? "s" : ""} effacée${res.removed > 1 ? "s" : ""}`);
        break;
      }

      /* ---- famille et réglages */
      case "member-new": {
        const colors = s.config.colors;
        const used = new Set(this.members.map((m) => m.color));
        const color = colors.find((c) => !used.has(c)) || colors[this.members.length % colors.length];
        s.stack.push({ type: "member", draft: { id: null, name: "", emoji: MEMBER_EMOJIS[0], color, role: "adult", person: "" } });
        this._renderOverlay(true);
        break;
      }
      case "member-open":
        s.stack.push({ type: "member", draft: { ...clone(this._member(d.id)), person: this._member(d.id).person || "" } });
        this._renderOverlay(true);
        break;
      case "member-save": {
        const f = top.draft;
        const member = { id: f.id, name: f.name, emoji: f.emoji, color: f.color, role: f.role, person: f.person || null };
        if (await this._call("members/save", { member })) this._dispatch("close");
        break;
      }
      case "member-delete":
        if (await this._confirm({ title: `Retirer ${top.draft.name} ?`, message: "Ses tâches et ses événements restent, sans personne attribuée." })) {
          await this._call("members/delete", { member_id: top.draft.id });
          this._dispatch("close");
        }
        break;
      case "setting-flip":
        await this._call("settings/save", { settings: { [d.key]: !s.data.settings[d.key] } });
        break;
      case "setting-time": {
        const value = this.shadowRoot.getElementById("reminder-time").value;
        if (value) await this._call("settings/save", { settings: { reminder_time: value } });
        break;
      }
      case "reminder-test": {
        const res = await this._call("reminder/test");
        if (!res) break;
        this._toast(
          res.sent
            ? `${plural(res.sent, "rappel")} envoyé${res.sent > 1 ? "s" : ""}`
            : "Aucun rappel envoyé : il faut une tâche pour aujourd'hui et un membre relié à un téléphone",
          !res.sent
        );
        break;
      }
    }
  }

  async _toggleTask(id) {
    const task = this.s.data.tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.done) {
      await this._call("tasks/reopen", { task_id: id });
      return;
    }
    // Vue filtrée sur un membre concerné : c'est lui qui a fait la tâche.
    const f = this.s.taskFilter;
    const member_id = this.s.tab === "tasks" && f !== "all" && (!task.assignees.length || task.assignees.includes(f)) ? f : null;
    const res = await this._call("tasks/complete", { task_id: id, member_id });
    if (!res) return;
    if (res.task.done) {
      this._toast("Tâche terminée 🎉", false, { label: "Annuler", run: () => this._call("tasks/reopen", { task_id: id }) });
    } else {
      this._toast(`Bravo ! Prochaine fois : ${dayLabel(res.task.due, this.today).toLowerCase()}`);
    }
  }

  _openTask(task = {}) {
    const rec = task.recurrence || { freq: "none", interval: 1 };
    this.s.stack.push({
      type: "task",
      draft: {
        id: task.id || null, title: task.title || "", notes: task.notes || "", assignees: [...(task.assignees || [])],
        due: task.due || "", time: task.time || "", list_id: task.list_id || "",
        freq: rec.freq, interval: rec.interval, rotate: Boolean(task.rotate), points: task.points ?? 1,
      },
    });
    this._renderOverlay(true);
  }

  _openEvent(ev = {}) {
    const rec = ev.recurrence || { freq: "none", interval: 1, until: null };
    const date = ev.date || this.today;
    // Nouvel événement : à la prochaine heure pleine.
    const hour = Math.min(new Date().getHours() + 1, 22);
    this.s.stack.push({
      type: "event",
      draft: {
        id: ev.id || null, title: ev.title || "", all_day: Boolean(ev.all_day), members: [...(ev.members || [])],
        startDate: ev.start ? ev.start.slice(0, 10) : date, startTime: ev.start && !ev.all_day ? ev.start.slice(11, 16) : `${pad(hour)}:00`,
        endDate: ev.end ? ev.end.slice(0, 10) : date, endTime: ev.end && !ev.all_day ? ev.end.slice(11, 16) : `${pad(hour + 1)}:00`,
        location: ev.location || "", notes: ev.notes || "", freq: rec.freq, interval: rec.interval, until: rec.until || "",
      },
    });
    this.top.prev = { startDate: this.top.draft.startDate, startTime: this.top.draft.startTime };
    this._renderOverlay(true);
  }

  /* La fin suit le début : même durée quand on déplace le début, jamais avant lui. */
  _fixEventEnd(changed = "") {
    const f = this.top.draft;
    const at = (date, time) => new Date(`${date}T${f.all_day ? "00:00" : time || "00:00"}`);
    const prev = this.top.prev || { startDate: f.startDate, startTime: f.startTime };
    if (/start(Date|Time)$/.test(changed)) {
      const shift = at(f.startDate, f.startTime) - at(prev.startDate, prev.startTime);
      if (shift) {
        const end = new Date(at(f.endDate, f.endTime).getTime() + shift);
        f.endDate = isoDate(end);
        if (!f.all_day) f.endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
      }
    }
    if (at(f.endDate, f.endTime) < at(f.startDate, f.startTime)) {
      f.endDate = f.startDate;
      f.endTime = f.startTime;
    }
    this.top.prev = { startDate: f.startDate, startTime: f.startTime };
  }

  /* ---------------- affichage */

  _fitHeight() {
    const top = Math.max(0, Math.round(this.getBoundingClientRect().top));
    if (top !== this._fmTop) {
      this._fmTop = top;
      this.style.setProperty("--fm-top", `${top}px`);
    }
  }

  _render() {
    const root = this.shadowRoot;
    if (!this._onResize) {
      this._onResize = () => this._fitHeight();
      window.addEventListener("resize", this._onResize);
    }
    requestAnimationFrame(() => this._fitHeight());
    if (!root.querySelector(".app")) {
      root.innerHTML = `<style>${STYLES}</style><div class="app"><div id="header"></div><main id="main"></main><div id="fab"></div><nav class="tabs" id="nav"></nav><div id="overlay"></div><div id="toast"></div><div id="dialog"></div></div>`;
    }
    const main = root.getElementById("main");
    // Une mise à jour venue d'un autre appareil ne doit ni faire sauter la page ni vider un champ en cours de saisie.
    const scroll = this._tabChanged ? 0 : main.scrollTop;
    const active = root.activeElement;
    const typing = active && active.id && main.contains(active) ? { id: active.id, value: active.value } : null;
    this._tabChanged = false;
    root.getElementById("header").innerHTML = this._tplHeader();
    const flush = this.s.data && this.s.tab === "lists";
    main.innerHTML = `<div class="page ${flush ? "flush" : ""}">${this.s.data ? this._tplTab() : `<div class="empty">Chargement…</div>`}</div>`;
    root.getElementById("fab").innerHTML = this.s.data ? this._tplFab() : "";
    main.scrollTop = scroll;
    if (typing) {
      const again = root.getElementById(typing.id);
      if (again) {
        again.value = typing.value;
        again.focus();
      }
    }
    root.getElementById("nav").innerHTML = this._tplNav();
    this._renderToast();
  }

  _renderOverlay(opening = false) {
    const host = this.shadowRoot.getElementById("overlay");
    const prev = host.querySelector(".body");
    const scroll = prev && !opening ? prev.scrollTop : 0;
    host.innerHTML = this.top ? this._tplOverlay(this.top) : "";
    const sheet = host.querySelector(".sheet");
    // Même fenêtre redessinée : pas d'animation d'ouverture.
    if (sheet && !opening) sheet.style.animation = "none";
    const body = host.querySelector(".body");
    if (body) body.scrollTop = scroll;
    if (opening) {
      const first = host.querySelector("[data-autofocus]");
      if (first && !first.value) first.focus();
    }
    this._renderToast();
  }

  _renderToast() {
    const host = this.shadowRoot.getElementById("toast");
    if (!host) return;
    const t = this.s.toast;
    host.innerHTML = t
      ? `<div class="toast ${t.error ? "error" : ""} ${this.s.stack.length ? "high" : ""}" role="status"><span>${esc(t.message)}</span>${t.action ? `<button data-action="toast-action">${esc(t.action.label)}</button>` : ""}</div>`
      : "";
  }

  _tplHeader() {
    return `<div class="toolbar">
      ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${icon("menu")}</button>` : `<span style="width:12px"></span>`}
      ${LOGO_SVG}
      <div class="title">Foyer Malin<small>par Adri</small></div>
    </div>`;
  }

  _tplNav() {
    const tabs = [
      ["home", "home-outline", "home", "Accueil"],
      ["agenda", "calendar-blank-outline", "calendar", "Agenda"],
      ["tasks", "checkbox-marked-circle-outline", "checkbox-marked-circle", "Tâches"],
      ["lists", "format-list-checkbox", "format-list-checks", "Listes"],
      ["family", "account-group-outline", "account-group", "Famille"],
    ];
    const due = this.s.data ? this._dueTasks().length : 0;
    return `<div class="inner">${tabs
      .map(
        ([key, ic, icActive, label]) =>
          `<button class="${this.s.tab === key ? "active" : ""}" data-action="tab" data-tab="${key}" aria-label="${label}"><span class="pill">${icon(this.s.tab === key ? icActive : ic)}${key === "tasks" && due ? `<span class="badge">${due > 99 ? "99+" : due}</span>` : ""}</span>${label}</button>`
      )
      .join("")}</div>`;
  }

  _tplTab() {
    switch (this.s.tab) {
      case "agenda":
        return this._tplAgenda();
      case "tasks":
        return this._tplTasks();
      case "lists":
        return this._list(this.s.listId) ? this._tplList(this._list(this.s.listId)) : this._tplLists();
      case "family":
        return this._tplFamily();
      default:
        return this._tplHome();
    }
  }

  _av(member, size = "") {
    return `<span class="av ${size}" style="--c:${safeColor(member.color)}" title="${esc(member.name)}">${esc(member.emoji)}</span>`;
  }

  _avs(ids, size = "small") {
    const found = ids.map((id) => this._member(id)).filter(Boolean);
    return found.length ? `<span class="avs">${found.map((m) => this._av(m, size)).join("")}</span>` : "";
  }

  /* Une tâche, comme dans une liste : rond à cocher, titre, date (rouge si en retard), répétition, membres. */
  _tplTask(task, { showList = false, showPoints = true } = {}) {
    const today = this.today;
    const who = task.assignees.map((id) => this._member(id)).filter(Boolean);
    const list = showList && task.list_id ? this._list(task.list_id) : null;
    const meta = [];
    if (task.due) meta.push(`<span class="${isLate(task, today) ? "late" : ""}">${icon("calendar-blank-outline")}${esc(taskWhen(task, today))}</span>`);
    if (task.recurrence.freq !== "none" && !task.done) meta.push(`<span>${icon("repeat")}${esc(recurrenceLabel(task.recurrence))}</span>`);
    if (task.rotate && who.length > 1 && !task.done) meta.push(`<span>Au tour de ${esc(who[0].name)}</span>`);
    if (list) meta.push(`<span>${esc(list.emoji)} ${esc(list.name)}</span>`);
    if (task.done && task.done_by && this._member(task.done_by)) meta.push(`<span>Fait par ${esc(this._member(task.done_by).name)}</span>`);
    const points = showPoints && this.s.data.settings.points && task.points && !task.done ? `<span class="pts">+${task.points} ⭐</span>` : "";
    return `<div class="trow ${task.done ? "done" : ""}">
      <button class="tcheck" data-action="task-toggle" data-id="${task.id}" role="checkbox" aria-checked="${task.done}" aria-label="${task.done ? "Remettre à faire" : "Terminer"} : ${esc(task.title)}">${icon(task.done ? "check-circle" : "circle-outline")}</button>
      <button class="tbody" data-action="task-open" data-id="${task.id}">
        <div class="t">${esc(task.title)}</div>${meta.length ? `<div class="m">${meta.join("")}</div>` : ""}
      </button>
      ${points}${this._avs(task.rotate ? task.assignees.slice(0, 1) : task.assignees)}
    </div>`;
  }

  _tplRows(tasks, opts) {
    return `<div class="trows">${tasks.map((t) => this._tplTask(t, opts)).join("")}</div>`;
  }

  _tplEvent(ev, showDay = false) {
    const first = this._member(ev.members[0]);
    const meta = [showDay ? `${dayLabel(ev.start.slice(0, 10), this.today)} · ${eventTime(ev)}` : eventTime(ev)];
    if (ev.location) meta.push(`📍 ${ev.location}`);
    return `<button class="ev" data-action="event-open" data-id="${ev.id}" ${first ? `style="--c:${safeColor(first.color)}"` : ""}>
      <span class="grow"><div class="t">${esc(ev.title)}${ev.recurrence.freq !== "none" ? " 🔁" : ""}</div><div class="m">${esc(meta.join(" · "))}</div></span>
      ${this._avs(ev.members)}
    </button>`;
  }

  /* ---- accueil */

  _tplHome() {
    const data = this.s.data;
    if (!data.members.length && !data.tasks.length && !data.events.length) {
      return `<div class="empty"><span class="big">🏡</span><h2>Bienvenue dans Foyer Malin</h2>
        <p style="margin-top:8px">Commencez par ajouter les membres de la famille : vous pourrez ensuite leur attribuer des tâches et des rendez-vous.</p>
        <button class="btn" data-action="tab" data-tab="family">${icon("account-plus-outline")} Ajouter la famille</button></div>`;
    }
    const due = this._dueTasks();
    const todayEvents = this.s.home.events.filter((e) => e.start.slice(0, 10) <= this.today);
    const nextEvents = this.s.home.events.filter((e) => e.start.slice(0, 10) > this.today).slice(0, 4);
    return `<div class="hello">${cap(fmtDay(this.today))}</div>
      <p class="sub">${due.length ? `${plural(due.length, "tâche")} à faire aujourd'hui` : "Aucune tâche en attente aujourd'hui 🎉"}</p>
      <div class="sec"><h3>Aujourd'hui</h3><button class="btn text" data-action="event-new">${icon("plus")} Événement</button></div>
      ${todayEvents.length ? todayEvents.map((e) => `<div style="margin-bottom:6px">${this._tplEvent(e)}</div>`).join("") : `<p class="sub">Rien de prévu dans l'agenda.</p>`}
      <div class="sec"><h3>À faire</h3><button class="btn text" data-action="task-new" data-due="${this.today}">${icon("plus")} Tâche</button></div>
      ${due.length ? `<div class="card flush">${this._tplRows(due, { showList: true })}</div>` : `<p class="sub">Tout est fait.</p>`}
      ${nextEvents.length ? `<div class="sec"><h3>Dans les prochains jours</h3></div>${nextEvents.map((e) => `<div style="margin-bottom:6px">${this._tplEvent(e, true)}</div>`).join("")}` : ""}
      ${this._tplScores()}`;
  }

  _tplScores() {
    const data = this.s.data;
    if (!data.settings.points || data.members.length < 2) return "";
    const rows = data.members
      .map((m) => ({ m, score: data.scores[m.id] || { points: 0, count: 0 } }))
      .sort((a, b) => b.score.points - a.score.points);
    const max = Math.max(1, rows[0].score.points);
    return `<div class="sec"><h3>Classement de la semaine</h3></div><div class="card">${rows
      .map(
        ({ m, score }, i) => `<div class="score" style="--c:${safeColor(m.color)}">${this._av(m)}
        <span style="width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i === 0 && score.points ? "🏆 " : ""}${esc(m.name)}</span>
        <span class="bar"><i style="width:${Math.round((score.points / max) * 100)}%"></i></span><span class="n">${score.points} ⭐</span></div>`
      )
      .join("")}</div>`;
  }

  /* ---- agenda */

  _tplAgenda() {
    const start = this.s.week.start;
    const today = this.today;
    const end = addDays(start, 6);
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const label = `${fmtDay(start, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${fmtDay(end, { day: "numeric", month: "short" })}`;
    const tasks = this._openTasks();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      // Un événement de plusieurs jours apparaît chaque jour qu'il couvre.
      const events = this.s.week.events.filter((e) => e.start.slice(0, 10) <= day && e.end.slice(0, 10) >= day);
      const due = tasks.filter((t) => t.due === day);
      const items = [
        ...events.map((e) => this._tplEvent(e)),
        ...due.map((t) => `<button class="ev todo" data-action="task-open" data-id="${t.id}">${icon("checkbox-blank-circle-outline")}<span class="grow"><div class="m" style="color:var(--fm-text)">${t.time ? `${esc(t.time)} · ` : ""}${esc(t.title)}</div></span>${this._avs(t.assignees)}</button>`),
      ];
      days.push(`<div class="day ${day === today ? "today" : day < today ? "past" : ""}">
        <button class="date" data-action="event-new" data-date="${day}" aria-label="Ajouter un événement ${esc(fmtDay(day))}"><span class="w">${esc(fmtDay(day, { weekday: "short" }).replace(".", ""))}</span><span class="n">${parseIso(day).getDate()}</span></button>
        <div class="items">${items.join("") || `<div class="none">—</div>`}</div>
      </div>`);
    }
    return `<div class="weeknav">
        <button class="icon-btn" data-action="week-prev" aria-label="Semaine précédente">${icon("chevron-left")}</button>
        <div class="label">${esc(label)}</div>
        ${start !== mondayOf(today) ? `<button class="btn text" data-action="week-today">Aujourd'hui</button>` : ""}
        <button class="icon-btn" data-action="week-next" aria-label="Semaine suivante">${icon("chevron-right")}</button>
      </div>
      ${days.join("")}
      <div style="text-align:center;margin-top:16px"><button class="btn" data-action="event-new" data-date="${start <= today && today <= end ? today : start}">${icon("plus")} Nouvel événement</button></div>`;
  }

  /* ---- tâches */

  _tplTasks() {
    const data = this.s.data;
    const today = this.today;
    const filter = this.s.taskFilter;
    const mine = (t) => filter === "all" || !t.assignees.length || t.assignees.includes(filter);
    const open = this._openTasks().filter(mine);
    const done = data.tasks.filter((t) => t.done && mine(t)).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
    const weekEnd = addDays(today, 7);
    const groups = [
      ["En retard", open.filter((t) => isLate(t, today)), "late"],
      ["Aujourd'hui", open.filter((t) => t.due === today && !isLate(t, today))],
      ["Cette semaine", open.filter((t) => t.due && t.due > today && t.due <= weekEnd)],
      ["Plus tard", open.filter((t) => t.due && t.due > weekEnd)],
      ["Sans date", open.filter((t) => !t.due)],
    ].filter(([, list]) => list.length);
    const chips = data.members.length
      ? `<div class="chips scroll"><button class="chip ${filter === "all" ? "on" : ""}" data-action="task-filter" data-id="all">Toute la famille</button>${data.members
          .map((m) => `<button class="chip ${filter === m.id ? "on" : ""}" data-action="task-filter" data-id="${m.id}">${esc(m.emoji)} ${esc(m.name)}</button>`)
          .join("")}</div>`
      : "";
    return `${chips}
      <div class="quick"><input class="input" id="task-quick" placeholder="Ajouter une tâche…" data-enter="task-quick" enterkeyhint="done" aria-label="Nouvelle tâche">
        <button class="btn tonal" data-action="task-new" aria-label="Nouvelle tâche détaillée">${icon("tune-variant")}</button></div>
      ${groups.map(([label, list, cls]) => `<div class="sec"><h3 class="${cls || ""}">${label} · ${list.length}</h3></div><div class="card flush">${this._tplRows(list, { showList: true })}</div>`).join("")}
      ${!open.length ? `<div class="empty"><span class="big">✨</span>Aucune tâche à faire${filter === "all" ? "" : ` pour ${esc(this._member(filter).name)}`}.</div>` : ""}
      ${done.length ? `<div class="sec"><button class="btn text" data-action="done-toggle">${icon(this.s.showDone ? "chevron-down" : "chevron-right")} Terminées · ${done.length}</button><span class="grow"></span>${this.s.showDone ? `<button class="btn danger" data-action="done-clear">Effacer</button>` : ""}</div>${this.s.showDone ? `<div class="card flush">${this._tplRows(done, { showList: true })}</div>` : ""}` : ""}`;
  }

  /* ---- listes */

  _tplLists() {
    const lists = [...this.s.data.lists].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    if (!lists.length) {
      return `<div class="empty" style="padding-top:48px"><span class="big">📋</span><h2>Vos listes</h2>
        <p style="margin-top:8px">Tâches ménagères, jardin, le chat… une liste partagée par toute la famille, avec des tâches datées, répétées et attribuées.</p>
        <button class="btn" data-action="list-new">${icon("plus")} Créer une liste</button></div>`;
    }
    return `<div class="lrows">${lists
      .map((l) => {
        const open = this._listTasks(l.id).filter((t) => !t.done);
        const late = open.filter((t) => isLate(t, this.today)).length;
        return `<button class="lrow" data-action="list-open" data-id="${l.id}"><span class="le">${esc(l.emoji)}</span>
          <span class="grow"><div class="t">${esc(l.name)}</div>
            <div class="m">${icon("account-multiple-outline")}Partagée${late ? `<span class="late">&nbsp;· ${late} en retard</span>` : ""}</div></span>
          <span class="count" aria-label="${plural(open.length, "tâche")} à faire">${open.length}</span></button>`;
      })
      .join("")}</div>`;
  }

  _tplList(list) {
    const tasks = this._listTasks(list.id);
    const open = tasks
      .filter((t) => !t.done)
      .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.time || "").localeCompare(b.time || "") || a.created_at.localeCompare(b.created_at));
    const done = tasks.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
    const people = new Set(open.flatMap((t) => t.assignees).filter((id) => this._member(id))).size;
    return `<div style="--lc:${this._listColor(list)}">
      <div class="lhero">
        <div class="lhero-top">
          <button class="round" data-action="list-back" aria-label="Retour aux listes">${icon("arrow-left")}</button><span class="grow"></span>
          ${people ? `<span class="round" title="Membres concernés">${icon("account-check-outline")}${people}</span>` : ""}
          <button class="round" data-action="list-edit" aria-label="Modifier la liste">${icon("dots-horizontal")}</button>
        </div>
        <h2>${esc(list.name)}</h2>
        <span class="lhero-art" aria-hidden="true">${esc(list.emoji)}</span>
        ${open.length ? `<span class="lhero-count">${open.length}</span>` : ""}
      </div>
      <label class="addrow">${icon("plus")}<input id="list-quick" placeholder="Ajouter" data-enter="list-task-quick" enterkeyhint="done" aria-label="Ajouter une tâche à ${esc(list.name)}"></label>
      ${tasks.length ? this._tplRows([...open, ...done], { showPoints: false }) : `<div class="empty">Aucune tâche pour l'instant.<br>Tapez-en une ci-dessus, ou touchez + pour la dater et l'attribuer.</div>`}
      ${done.length ? `<button class="btn text lclear" data-action="list-clear-done">Effacer les terminées (${done.length})</button>` : ""}
    </div>`;
  }

  /* Bouton + flottant : nouvelle liste, ou nouvelle tâche dans la liste ouverte. */
  _tplFab() {
    if (this.s.tab !== "lists") return "";
    const list = this._list(this.s.listId);
    if (list) return `<button class="fab" style="--lc:${this._listColor(list)}" data-action="task-new" aria-label="Nouvelle tâche">${icon("plus")}</button>`;
    return this.s.data.lists.length ? `<button class="fab" data-action="list-new" aria-label="Nouvelle liste">${icon("plus")}</button>` : "";
  }

  /* ---- famille */

  _tplFamily() {
    const data = this.s.data;
    const st = data.settings;
    const toggle = (key, label, sub) => `<div class="switch"><div class="grow"><div>${label}</div><div class="sub">${sub}</div></div>
      <button class="toggle ${st[key] ? "on" : ""}" data-action="setting-flip" data-key="${key}" role="switch" aria-checked="${st[key]}" aria-label="${label}"></button></div>`;
    return `<div class="sec"><h3>La famille</h3><button class="btn text" data-action="member-new">${icon("plus")} Ajouter</button></div>
      ${data.members
        .map((m) => {
          const score = data.scores[m.id] || { points: 0, count: 0 };
          const bits = [m.role === "child" ? "Enfant" : "Adulte"];
          if (score.count) bits.push(`${plural(score.count, "tâche")} cette semaine`);
          if (m.person) bits.push("📱 rappels");
          return `<button class="member" data-action="member-open" data-id="${m.id}">${this._av(m, "big")}<span class="grow"><div class="t">${esc(m.name)}</div><div class="sub">${esc(bits.join(" · "))}</div></span>${st.points ? `<span class="pts">${score.points} ⭐</span>` : ""}</button>`;
        })
        .join("") || `<div class="empty"><span class="big">👨‍👩‍👧</span>Ajoutez chaque membre de la famille pour lui attribuer des tâches et des rendez-vous.</div>`}
      <div class="sec"><h3>Réglages</h3></div>
      <div class="card">
        ${toggle("reminder", "Rappel des tâches du jour", "Une notification sur le téléphone des membres reliés à une personne de Home Assistant.")}
        ${st.reminder ? `<div class="switch"><div class="grow">Heure du rappel</div><input class="input" id="reminder-time" type="time" value="${esc(st.reminder_time)}" style="width:auto" aria-label="Heure du rappel"><button class="btn tonal" data-action="setting-time">OK</button></div>
        ${this.s.config.is_admin ? `<button class="btn text" data-action="reminder-test" style="padding:0">${icon("bell-ring-outline")} Envoyer le rappel maintenant</button>` : ""}` : ""}
        ${toggle("points", "Points et classement", "Chaque tâche terminée rapporte des points ; le classement repart de zéro chaque lundi.")}
      </div>
      <p class="sub" style="text-align:center;margin-top:20px">Foyer Malin par Adri · version ${esc(this.s.config.version)}${this.s.config.version !== FOYER_VERSION ? " (rechargez la page pour finir la mise à jour)" : ""}</p>`;
  }

  /* ---- fenêtres d'édition */

  _tplOverlay(top) {
    const f = top.draft;
    const titles = { task: ["Nouvelle tâche", "Modifier la tâche"], event: ["Nouvel événement", "Modifier l'événement"], member: ["Nouveau membre", "Modifier le membre"], list: ["Nouvelle liste", "Modifier la liste"] };
    const body = { task: () => this._tplTaskForm(f), event: () => this._tplEventForm(f), member: () => this._tplMemberForm(f), list: () => this._tplListForm(f) }[top.type]();
    return `<div class="sheet" role="dialog" aria-modal="true">
      <div class="toolbar"><button class="icon-btn" data-action="close" aria-label="Fermer">${icon("close")}</button><div class="title">${titles[top.type][f.id ? 1 : 0]}</div></div>
      <div class="body"><div class="page">${body}</div></div>
      <div class="footer">${f.id ? `<button class="btn danger" data-action="${top.type}-delete">${icon("delete-outline")} Supprimer</button>` : "<span></span>"}
        <button class="btn" data-action="${top.type}-save">Enregistrer</button></div>
    </div>`;
  }

  _tplMemberChips(field, selected) {
    if (!this.members.length) return `<p class="hint" style="margin:0 0 14px">Ajoutez des membres dans l'onglet Famille pour les choisir ici.</p>`;
    return `<div class="chips" style="margin-bottom:14px">${this.members
      .map((m) => `<button class="chip ${selected.includes(m.id) ? "on" : ""}" data-action="pick" data-field="${field}" data-id="${m.id}" aria-pressed="${selected.includes(m.id)}">${esc(m.emoji)} ${esc(m.name)}</button>`)
      .join("")}</div>`;
  }

  _tplRepeat(f) {
    const unit = f.freq !== "none" ? FREQ_UNITS[f.freq][Number(f.interval) > 1 ? 1 : 0] : "";
    return `<div class="${f.freq === "none" ? "" : "two repeat"}">
      <label class="field"><span>Répétition</span><select class="input" data-path="top.draft.freq" data-refresh>${Object.entries(FREQ_LABELS)
        .map(([key, label]) => `<option value="${key}" ${f.freq === key ? "selected" : ""}>${label}</option>`)
        .join("")}</select></label>
      ${f.freq === "none" ? "" : `<label class="field"><span>Tous les… (${unit})</span><input class="input" type="number" min="1" max="99" inputmode="numeric" data-path="top.draft.interval" data-refresh value="${esc(f.interval)}"></label>`}
    </div>`;
  }

  _tplTaskForm(f) {
    const several = f.assignees.length > 1;
    return `<label class="field"><span>Tâche</span><input class="input" data-path="top.draft.title" data-autofocus value="${esc(f.title)}" placeholder="Sortir les poubelles" maxlength="200"></label>
      <div class="field-label">Pour qui ? ${f.assignees.length ? "" : "(personne en particulier)"}</div>
      ${this._tplMemberChips("assignees", f.assignees)}
      <div class="two">
        <label class="field"><span>À faire pour le</span><input class="input" type="date" data-path="top.draft.due" data-refresh value="${esc(f.due)}"></label>
        <label class="field"><span>Heure (facultatif)</span><input class="input" type="time" data-path="top.draft.time" value="${esc(f.time)}" ${f.due ? "" : "disabled"}></label>
      </div>
      <label class="field"><span>Liste</span><select class="input" data-path="top.draft.list_id"><option value="">Aucune</option>${this.s.data.lists
        .map((l) => `<option value="${l.id}" ${l.id === f.list_id ? "selected" : ""}>${esc(l.emoji)} ${esc(l.name)}</option>`)
        .join("")}</select></label>
      ${this._tplRepeat(f)}
      ${f.freq !== "none" ? `<p class="hint">Une fois faite, la tâche revient à sa prochaine date.</p>` : ""}
      ${f.freq !== "none" && several ? `<div class="switch" style="margin-bottom:8px"><div class="grow"><div>Chacun son tour</div><div class="sub">La tâche passe au membre suivant à chaque fois.</div></div><button class="toggle ${f.rotate ? "on" : ""}" data-action="flip" data-field="rotate" role="switch" aria-checked="${Boolean(f.rotate)}" aria-label="Chacun son tour"></button></div>` : ""}
      ${this.s.data.settings.points ? `<div class="switch" style="margin-bottom:8px"><div class="grow">Points gagnés</div><span class="stepper">
        <button class="icon-btn" data-action="step" data-field="points" data-delta="-1" data-min="0" data-max="20" aria-label="Moins de points">${icon("minus")}</button><b>${f.points}</b>
        <button class="icon-btn" data-action="step" data-field="points" data-delta="1" data-min="0" data-max="20" aria-label="Plus de points">${icon("plus")}</button></span></div>` : ""}
      <label class="field"><span>Note</span><textarea class="input" data-path="top.draft.notes" maxlength="1000">${esc(f.notes)}</textarea></label>`;
  }

  _tplEventForm(f) {
    const dateTime = (label, key) => `<div class="${f.all_day ? "" : "two"}">
      <label class="field"><span>${label}</span><input class="input" type="date" data-path="top.draft.${key}Date" data-refresh value="${esc(f[key + "Date"])}"></label>
      ${f.all_day ? "" : `<label class="field"><span>Heure</span><input class="input" type="time" data-path="top.draft.${key}Time" data-refresh value="${esc(f[key + "Time"])}"></label>`}</div>`;
    return `<label class="field"><span>Événement</span><input class="input" data-path="top.draft.title" data-autofocus value="${esc(f.title)}" placeholder="Rendez-vous chez le dentiste" maxlength="200"></label>
      <div class="switch" style="margin-bottom:8px"><div class="grow">Toute la journée</div><button class="toggle ${f.all_day ? "on" : ""}" data-action="flip" data-field="all_day" role="switch" aria-checked="${f.all_day}" aria-label="Toute la journée"></button></div>
      ${dateTime("Début", "start")}${dateTime("Fin", "end")}
      <div class="field-label">Qui est concerné ?</div>
      ${this._tplMemberChips("members", f.members)}
      <label class="field"><span>Lieu</span><input class="input" data-path="top.draft.location" value="${esc(f.location)}" maxlength="200"></label>
      ${this._tplRepeat(f)}
      ${f.freq !== "none" ? `<label class="field"><span>Jusqu'au (laisser vide : sans fin)</span><input class="input" type="date" data-path="top.draft.until" value="${esc(f.until)}"></label>${f.id ? `<p class="hint">Les changements s'appliquent à toutes les répétitions.</p>` : ""}` : ""}
      <label class="field"><span>Note</span><textarea class="input" data-path="top.draft.notes" maxlength="1000">${esc(f.notes)}</textarea></label>`;
  }

  _tplEmojis(choices, current) {
    const all = choices.includes(current) ? choices : [current, ...choices];
    return `<div class="emojis" style="margin-bottom:14px">${all
      .map((e) => `<button class="${e === current ? "on" : ""}" data-action="set" data-field="emoji" data-value="${esc(e)}" aria-pressed="${e === current}">${esc(e)}</button>`)
      .join("")}</div>`;
  }

  _tplMemberForm(f) {
    const persons = this.s.config.persons;
    return `<label class="field"><span>Prénom</span><input class="input" data-path="top.draft.name" data-autofocus value="${esc(f.name)}" maxlength="40"></label>
      <div class="field-label">Avatar</div>${this._tplEmojis(MEMBER_EMOJIS, f.emoji)}
      <div class="field-label">Couleur</div>
      <div class="swatches" style="margin-bottom:14px">${this.s.config.colors
        .map((c) => `<button class="swatch ${c === f.color ? "on" : ""}" style="--c:${safeColor(c)}" data-action="set" data-field="color" data-value="${c}" aria-label="Couleur ${c}" aria-pressed="${c === f.color}"></button>`)
        .join("")}</div>
      <div class="field-label">Rôle</div>
      <div class="chips" style="margin-bottom:14px">
        <button class="chip ${f.role === "adult" ? "on" : ""}" data-action="set" data-field="role" data-value="adult">Adulte</button>
        <button class="chip ${f.role === "child" ? "on" : ""}" data-action="set" data-field="role" data-value="child">Enfant</button></div>
      <label class="field"><span>Personne dans Home Assistant (pour les rappels sur son téléphone)</span>
        <select class="input" data-path="top.draft.person"><option value="">Aucune</option>${persons
          .map((p) => `<option value="${esc(p.entity_id)}" ${p.entity_id === f.person ? "selected" : ""}>${esc(p.name)}</option>`)
          .join("")}</select></label>
      <p class="hint">Les adultes reçoivent aussi le rappel des tâches attribuées à personne.</p>`;
  }

  _tplListForm(f) {
    return `<label class="field"><span>Nom de la liste</span><input class="input" data-path="top.draft.name" data-autofocus value="${esc(f.name)}" placeholder="Valise des vacances" maxlength="60"></label>
      <div class="field-label">Icône</div>${this._tplEmojis(LIST_EMOJIS, f.emoji)}
      <div class="field-label">Couleur</div>
      <div class="swatches" style="margin-bottom:14px">${this.s.config.list_colors
        .map((c) => `<button class="swatch ${c === f.color ? "on" : ""}" style="--c:${safeColor(c)}" data-action="set" data-field="color" data-value="${c}" aria-label="Couleur ${c}" aria-pressed="${c === f.color}"></button>`)
        .join("")}</div>`;
  }
}

if (!customElements.get("foyer-malin-panel")) customElements.define("foyer-malin-panel", FoyerMalinPanel);
