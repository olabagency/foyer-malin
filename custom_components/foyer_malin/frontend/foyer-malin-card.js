/*
 * Foyer Malin — carte de tableau de bord « Aujourd'hui en famille ».
 * Ajout : Modifier le tableau de bord → Ajouter une carte → « Foyer Malin – Aujourd'hui en famille ».
 * Elle lit sensor.foyer_malin_taches_du_jour et sensor.foyer_malin_prochain_evenement.
 */

const FYC_DEFAULTS = {
  tasks_entity: "sensor.foyer_malin_taches_du_jour",
  event_entity: "sensor.foyer_malin_prochain_evenement",
  max_tasks: 4,
};
const fycEsc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

class FoyerMalinCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = { ...FYC_DEFAULTS, ...(config || {}) };
    this._key = null;
    if (this._hass) this._render();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 4, rows: 4, min_rows: 3 };
  }

  set hass(hass) {
    this._hass = hass;
    const key = [this._config.tasks_entity, this._config.event_entity]
      .map((id) => (hass.states[id] ? hass.states[id].last_updated : "none"))
      .join("|");
    if (key !== this._key) {
      this._key = key;
      this._render();
    }
  }

  _navigate(url) {
    history.pushState(null, "", url);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => {
        const el = ev.composedPath().find((n) => n.dataset && n.dataset.url);
        if (el) this._navigate(el.dataset.url);
      });
    }
    const tasksState = this._hass.states[this._config.tasks_entity];
    const eventState = this._hass.states[this._config.event_entity];
    let body;
    if (!tasksState || !eventState) {
      body = `<div class="empty">Foyer Malin n'est pas encore configuré.</div>`;
    } else {
      const ev = eventState.attributes;
      const tasks = tasksState.attributes.tasks || [];
      const shown = tasks.slice(0, this._config.max_tasks);
      const count = Number(tasksState.state) || 0;
      const when = ev.planned ? [ev.label, ev.time].filter(Boolean).join(" · ") : "";
      const who = ev.planned && ev.members.length ? ev.members.join(", ") : "";
      body = `
        <button class="event" data-url="/foyer-malin?tab=agenda">
          <span class="emoji">${ev.planned ? "📅" : "🌤️"}</span>
          <span class="grow">
            <span class="label">${ev.planned ? fycEsc(when) : "Agenda"}</span>
            <span class="title">${ev.planned ? fycEsc(eventState.state) : "Rien de prévu"}</span>
            ${who || ev.location ? `<span class="meta">${fycEsc([who, ev.location].filter(Boolean).join(" · "))}</span>` : ""}
          </span>
        </button>
        <div class="content">
          <div class="label">${count ? `${count} tâche${count > 1 ? "s" : ""} à faire aujourd'hui` : "Aucune tâche en attente 🎉"}</div>
          ${shown
            .map(
              (t) => `<div class="task ${t.overdue ? "late" : ""}"><span class="dot"></span><span class="grow">${fycEsc(t.title)}</span>${
                t.assignees.length ? `<span class="who">${fycEsc(t.assignees.join(", "))}</span>` : ""
              }</div>`
            )
            .join("")}
          ${count > shown.length && shown.length ? `<div class="more">et ${count - shown.length} de plus</div>` : ""}
          <div class="actions"><button class="primary" data-url="/foyer-malin?tab=tasks">✅ Voir les tâches</button></div>
        </div>`;
    }
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { overflow: hidden; height: 100%; display: flex; flex-direction: column; }
        button { font: inherit; cursor: pointer; }
        .event {
          display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; border: 0; padding: 16px;
          color: var(--primary-text-color);
          background: linear-gradient(135deg, color-mix(in srgb, #6e56cf 28%, transparent), color-mix(in srgb, #ff6b8b 22%, transparent));
        }
        .emoji { font-size: 38px; }
        .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .label { color: var(--secondary-text-color); font-size: 13px; text-transform: uppercase; letter-spacing: .05em; }
        .title { font-size: 20px; font-weight: 500; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .meta, .more, .who { color: var(--secondary-text-color); font-size: 13px; }
        .content { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .task { display: flex; align-items: center; gap: 10px; font-size: 15px; color: var(--primary-text-color); }
        .task .grow { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--secondary-text-color); flex-shrink: 0; }
        .task.late .dot { border-color: var(--error-color, #db4437); }
        .who { flex-shrink: 0; }
        .actions { margin-top: auto; padding-top: 8px; }
        button.primary {
          font-weight: 500; font-size: 14px; border-radius: 20px; min-height: 40px; padding: 0 16px; border: 0;
          background: var(--primary-color); color: var(--text-primary-color, #fff);
        }
        .empty { padding: 16px; color: var(--secondary-text-color); }
      </style>
      <ha-card>${body}</ha-card>`;
  }
}

if (!customElements.get("foyer-malin-card")) {
  customElements.define("foyer-malin-card", FoyerMalinCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "foyer-malin-card",
    name: "Foyer Malin par Adri – Aujourd'hui en famille",
    description: "Le prochain événement de l'agenda et les tâches à faire aujourd'hui.",
    preview: true,
  });
}

/* ======================================================================
 * Widgets de tableau de bord
 * Ajout : Modifier le tableau de bord → Ajouter une carte → « Foyer Malin – … ».
 * Ils se tiennent à jour tout seuls (même flux que le panneau) et se règlent
 * dans l'éditeur visuel de la carte, ou en YAML (voir le README).
 * ====================================================================== */

const fwFold = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const fwEsc = fycEsc;
const fwColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : "#888888");
const fwPad = (n) => String(n).padStart(2, "0");
const fwIso = (d) => `${d.getFullYear()}-${fwPad(d.getMonth() + 1)}-${fwPad(d.getDate())}`;
const fwParse = (s) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fwAdd = (iso, n) => {
  const d = fwParse(iso);
  d.setDate(d.getDate() + n);
  return fwIso(d);
};
const fwNow = () => {
  const d = new Date();
  return `${fwPad(d.getHours())}:${fwPad(d.getMinutes())}`;
};
const fwPlural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
const fwCap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function fwDayLabel(iso, today) {
  const delta = Math.round((fwParse(iso) - fwParse(today)) / 86400000);
  if (delta === 0) return "Aujourd'hui";
  if (delta === 1) return "Demain";
  if (delta === -1) return "Hier";
  if (delta > 1 && delta < 7) return fwCap(fwParse(iso).toLocaleDateString("fr-FR", { weekday: "long" }));
  return fwParse(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/* En retard : date passée, ou aujourd'hui à une heure déjà passée. */
const fwLate = (t, today) => Boolean(t.due) && (t.due < today || (t.due === today && Boolean(t.time) && t.time < fwNow()));

function fwEventTime(ev) {
  if (ev.all_day) return ev.end > ev.start ? `Jusqu'au ${fwParse(ev.end).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : "Journée";
  return ev.start.slice(11, 16);
}

const FW_STYLES = `
  :host { display: block; }
  ha-card { overflow: hidden; height: 100%; display: flex; flex-direction: column; }
  button { font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 6px; }
  .head .title { flex: 1; min-width: 0; border: 0; background: none; text-align: left; padding: 0; font-size: 18px; font-weight: 500;
    color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { min-width: 28px; height: 28px; padding: 0 9px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); font-size: 14px; font-weight: 600; color: var(--primary-text-color); }
  .badge.late { background: color-mix(in srgb, var(--error-color, #db4437) 16%, transparent); color: var(--error-color, #db4437); }
  .body { padding: 2px 0 8px; flex: 1; }
  .empty { padding: 18px 16px 22px; text-align: center; color: var(--secondary-text-color); }
  .empty .big { display: block; font-size: 34px; margin-bottom: 4px; }
  .error { padding: 16px; color: var(--secondary-text-color); }
  .more { display: block; width: 100%; border: 0; background: none; padding: 6px 16px 10px; text-align: left; font-size: 13px; color: var(--primary-color); }
  .row { display: flex; align-items: center; gap: 12px; padding: 6px 16px; min-height: 48px; transition: opacity .25s; }
  .row.busy { opacity: .4; }
  .row .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .row .t { font-size: 16px; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row .m { font-size: 13px; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row.late .m .when { color: var(--error-color, #db4437); font-weight: 500; }
  .check { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; border: 0; background: none; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
  .check::before { content: ""; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--secondary-text-color); box-sizing: border-box; transition: background .15s, border-color .15s; }
  .check:hover::before, .check:focus-visible::before { border-color: var(--lc, var(--primary-color)); background: color-mix(in srgb, var(--lc, var(--primary-color)) 18%, transparent); }
  .avs { display: inline-flex; flex-shrink: 0; }
  .av { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;
    background: color-mix(in srgb, var(--c) 22%, var(--card-background-color, #fff)); border: 2px solid var(--c); box-sizing: border-box; flex-shrink: 0; }
  .avs .av + .av { margin-left: -10px; }
  .av.big { width: 42px; height: 42px; font-size: 22px; }
  .day { padding: 8px 16px 2px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--secondary-text-color); }
  .day.today { color: var(--primary-color); }
  .time { width: 48px; flex-shrink: 0; font-size: 14px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
  .bar { height: 6px; border-radius: 3px; background: var(--divider-color); overflow: hidden; margin-top: 5px; }
  .bar i { display: block; height: 100%; border-radius: 3px; background: var(--c); }
  .pts { font-weight: 600; font-size: 15px; color: var(--primary-text-color); white-space: nowrap; }
  .medal { width: 28px; text-align: center; font-size: 22px; flex-shrink: 0; }
  .row.link { width: 100%; border: 0; background: none; text-align: left; }
  .addrow { display: flex; align-items: center; gap: 10px; padding: 4px 16px 10px; }
  .addrow input { flex: 1; min-width: 0; font: inherit; color: var(--primary-text-color); background: none; border: 0; border-bottom: 1px solid var(--divider-color); padding: 8px 0; outline: none; }
  .addrow input:focus { border-bottom-color: var(--lc, var(--primary-color)); }
  .lhead { background: var(--lc); color: #fff; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
  .lhead .e { font-size: 30px; }
  .lhead .title { color: #fff; font-size: 20px; font-weight: 600; flex: 1; border: 0; background: none; text-align: left; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lhead .badge { background: rgba(0,0,0,.3); color: #fff; }
`;

class FoyerWidget extends HTMLElement {
  static get defaults() {
    return {};
  }

  setConfig(config) {
    this._config = { ...this.constructor.defaults, ...(config || {}) };
    this._paintNow();
  }

  set hass(hass) {
    this._hass = hass;
    this._subscribe();
  }

  connectedCallback() {
    if (this._hass) this._subscribe();
  }

  disconnectedCallback() {
    this._unsubscribe();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: "auto" };
  }

  _unsubscribe() {
    if (this._unsub) {
      try {
        this._unsub();
      } catch (_) {
        /* déjà fermé */
      }
    }
    this._unsub = null;
  }

  /* Toutes les données du foyer, renvoyées à chaque changement fait sur n'importe quel appareil. */
  async _subscribe() {
    if (this._unsub || this._subscribing || !this.isConnected || !this._hass) return;
    this._subscribing = true;
    try {
      const unsub = await this._hass.connection.subscribeMessage(
        (data) => {
          this._data = data;
          this._error = null;
          this._refresh();
        },
        { type: "foyer_malin/subscribe" }
      );
      if (this.isConnected) this._unsub = unsub;
      else unsub();
    } catch (_) {
      this._error = "Foyer Malin n'est pas configuré.";
      this._paintNow();
    }
    this._subscribing = false;
  }

  /* Crochet : les widgets qui ont besoin d'autre chose (agenda) le complètent. */
  async _refresh() {
    this._paintNow();
  }

  async _call(payload) {
    try {
      return await this._hass.callWS(payload);
    } catch (_) {
      return null;
    }
  }

  async _loadMe() {
    if (this._me !== undefined || this._meLoading) return;
    this._meLoading = true;
    const config = await this._call({ type: "foyer_malin/config" });
    this._me = config ? config.me : null;
    this._meLoading = false;
    this._paintNow();
  }

  /* « Léa », identifiant, ou « me » : la personne connectée à Home Assistant. */
  _member(ref) {
    if (!ref || !this._data) return null;
    const key = fwFold(ref);
    if (key === "me" || key === "moi") {
      this._loadMe();
      return this._data.members.find((m) => m.id === this._me) || null;
    }
    return this._data.members.find((m) => m.id === ref || fwFold(m.name) === key) || null;
  }

  _list(ref) {
    if (!ref || !this._data) return null;
    const key = fwFold(ref);
    return this._data.lists.find((l) => l.id === ref || fwFold(l.name) === key) || null;
  }

  _navigate(url) {
    history.pushState(null, "", url);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _av(member, big = false) {
    return `<span class="av ${big ? "big" : ""}" style="--c:${fwColor(member.color)}" title="${fwEsc(member.name)}">${fwEsc(member.emoji)}</span>`;
  }

  _avs(ids) {
    const found = (ids || []).map((id) => this._data.members.find((m) => m.id === id)).filter(Boolean);
    return found.length ? `<span class="avs">${found.map((m) => this._av(m)).join("")}</span>` : "";
  }

  _head(title, url, badge = "") {
    return `<div class="head"><button class="title" data-url="${fwEsc(url)}">${fwEsc(title)}</button>${badge}</div>`;
  }

  /* Une tâche : rond à cocher, titre, quand, liste, membres. */
  _taskRow(task, { showList = false, color = "" } = {}) {
    const today = this._data.today;
    const late = fwLate(task, today);
    const list = showList && task.list_id ? this._data.lists.find((l) => l.id === task.list_id) : null;
    const meta = [];
    if (task.due) meta.push(`<span class="when">${fwEsc(fwDayLabel(task.due, today))}${task.time ? `, ${fwEsc(task.time)}` : ""}</span>`);
    if (task.recurrence && task.recurrence.freq !== "none") meta.push("🔁");
    if (list) meta.push(`${fwEsc(list.emoji)} ${fwEsc(list.name)}`);
    return `<div class="row ${late ? "late" : ""}" ${color ? `style="--lc:${color}"` : ""}>
      <button class="check" data-action="complete" data-id="${fwEsc(task.id)}" aria-label="Terminer : ${fwEsc(task.title)}"></button>
      <span class="grow"><span class="t">${fwEsc(task.title)}</span>${meta.length ? `<span class="m">${meta.join(" · ")}</span>` : ""}</span>
      ${this._avs(task.assignees)}
    </div>`;
  }

  _sortTasks(tasks) {
    return tasks.sort(
      (a, b) =>
        (a.due || "9999").localeCompare(b.due || "9999") ||
        (a.time || "").localeCompare(b.time || "") ||
        (a.created_at || "").localeCompare(b.created_at || "")
    );
  }

  /* Tâches à faire pour un membre : les siennes et celles de personne. */
  _forMember(tasks, member) {
    return member ? tasks.filter((t) => !t.assignees.length || t.assignees.includes(member.id)) : tasks;
  }

  /* Dessine en gardant ce qu'on était en train de taper (champ « Ajouter »). */
  _paintNow() {
    if (!this._config) return;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
      this.shadowRoot.addEventListener("keydown", (ev) => this._onKey(ev));
    }
    const root = this.shadowRoot;
    const input = root.activeElement && root.activeElement.tagName === "INPUT" ? root.activeElement : null;
    const keep = input ? { name: input.name, value: input.value } : null;
    let body;
    if (this._error) body = `<div class="error">${fwEsc(this._error)}</div>`;
    else if (!this._data) body = `<div class="empty">Chargement…</div>`;
    else body = this._body();
    root.innerHTML = `<style>${FW_STYLES}${this.constructor.styles || ""}</style><ha-card>${body}</ha-card>`;
    if (keep) {
      const again = root.querySelector(`input[name="${keep.name}"]`);
      if (again) {
        again.value = keep.value;
        again.focus();
      }
    }
  }

  _onClick(ev) {
    const path = ev.composedPath();
    const nav = path.find((n) => n.dataset && n.dataset.url);
    if (nav && !path.some((n) => n.dataset && n.dataset.action)) return this._navigate(nav.dataset.url);
    const el = path.find((n) => n.dataset && n.dataset.action);
    if (el) this._act(el.dataset.action, el);
  }

  _onKey(ev) {
    if (ev.key === "Enter" && ev.target.dataset && ev.target.dataset.enter && !ev.isComposing) {
      ev.preventDefault();
      this._act(ev.target.dataset.enter, ev.target);
    }
  }

  async _act(action, el) {
    if (action !== "complete") return;
    const row = el.closest(".row");
    if (row) row.classList.add("busy");
    const task = this._data.tasks.find((t) => t.id === el.dataset.id);
    const member = this._member(this._config.member);
    // Les points vont au membre de la carte si la tâche est à lui (ou à personne) ; sinon au serveur de décider.
    const mine = member && task && (!task.assignees.length || task.assignees.includes(member.id));
    const res = await this._call({ type: "foyer_malin/tasks/complete", task_id: el.dataset.id, member_id: mine ? member.id : null });
    if (!res && row) row.classList.remove("busy");
  }

  /* Éditeur visuel de la carte (Home Assistant). */
  static _form(schema, labels) {
    return { schema, computeLabel: (s) => labels[s.name] || s.name };
  }
}

const FW_MEMBER_HELP = "Prénom du membre (ou « me » pour la personne connectée). Vide : toute la famille.";

/* ---------- Tâches du jour ---------- */

class FoyerTasksCard extends FoyerWidget {
  static get defaults() {
    return { title: "", member: "", list: "", scope: "today", max_tasks: 6, show_list: true };
  }
  static getStubConfig() {
    return { scope: "today" };
  }
  static getConfigForm() {
    return FoyerWidget._form(
      [
        { name: "title", selector: { text: {} } },
        { name: "member", selector: { text: {} } },
        { name: "list", selector: { text: {} } },
        { name: "scope", selector: { select: { mode: "dropdown", options: [{ value: "today", label: "Aujourd'hui et retards" }, { value: "week", label: "7 prochains jours" }, { value: "all", label: "Toutes les tâches à faire" }] } } },
        { name: "max_tasks", selector: { number: { min: 1, max: 30, mode: "box" } } },
        { name: "show_list", selector: { boolean: {} } },
      ],
      { title: "Titre (facultatif)", member: "Membre (« me » : la personne connectée)", list: "Liste (nom, facultatif)", scope: "Tâches à afficher", max_tasks: "Nombre maximum de tâches", show_list: "Afficher le nom de la liste" }
    );
  }
  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: 4, min_rows: 2 };
  }

  _body() {
    const c = this._config;
    const member = c.member ? this._member(c.member) : null;
    if (c.member && !member) return `<div class="error">${this._me === undefined && fwFold(c.member).match(/^(me|moi)$/) ? "Chargement…" : `Membre introuvable : ${fwEsc(c.member)}`}</div>`;
    const list = c.list ? this._list(c.list) : null;
    if (c.list && !list) return `<div class="error">Liste introuvable : ${fwEsc(c.list)}</div>`;
    const today = this._data.today;
    const limit = c.scope === "all" ? "9999-12-31" : c.scope === "week" ? fwAdd(today, 6) : today;
    let tasks = this._data.tasks.filter((t) => !t.done && (c.scope === "all" || (t.due && t.due <= limit)));
    if (list) tasks = tasks.filter((t) => t.list_id === list.id);
    tasks = this._sortTasks(this._forMember(tasks, member));
    const shown = tasks.slice(0, Math.max(1, Number(c.max_tasks) || 6));
    const late = tasks.filter((t) => fwLate(t, today)).length;
    const title = c.title || (member ? `Tâches de ${member.name}` : list ? list.name : c.scope === "today" ? "Tâches du jour" : "Tâches à faire");
    const url = `/foyer-malin?tab=tasks${member ? `&member=${member.id}` : ""}`;
    const badge = tasks.length ? `<span class="badge ${late ? "late" : ""}" title="${late ? fwPlural(late, "retard") : ""}">${tasks.length}</span>` : "";
    return `${this._head(title, url, badge)}<div class="body">${
      shown.length
        ? shown.map((t) => this._taskRow(t, { showList: c.show_list && !list })).join("")
        : `<div class="empty"><span class="big">🎉</span>${c.scope === "today" ? "Rien à faire aujourd'hui" : "Aucune tâche à faire"}</div>`
    }${tasks.length > shown.length ? `<button class="more" data-url="${fwEsc(url)}">et ${tasks.length - shown.length} de plus</button>` : ""}</div>`;
  }
}

/* ---------- Classement des points ---------- */

class FoyerRankingCard extends FoyerWidget {
  static get defaults() {
    return { title: "", period: "month", show_count: true };
  }
  static getStubConfig() {
    return { period: "month" };
  }
  static getConfigForm() {
    return FoyerWidget._form(
      [
        { name: "title", selector: { text: {} } },
        { name: "period", selector: { select: { mode: "dropdown", options: [{ value: "month", label: "Ce mois-ci" }, { value: "week", label: "Cette semaine" }] } } },
        { name: "show_count", selector: { boolean: {} } },
      ],
      { title: "Titre (facultatif)", period: "Période", show_count: "Afficher le nombre de tâches" }
    );
  }
  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: 3, min_rows: 2 };
  }

  _body() {
    const c = this._config;
    const month = c.period !== "week";
    const title = c.title || (month ? "Top points du mois" : "Top points de la semaine");
    const url = "/foyer-malin?tab=home";
    if (!this._data.settings.points) return `${this._head(title, url)}<div class="empty">Les points sont désactivés dans les réglages de Foyer Malin.</div>`;
    const scores = (month ? this._data.scores_month : this._data.scores) || {};
    const rows = this._data.members
      .map((m) => ({ m, points: (scores[m.id] || {}).points || 0, count: (scores[m.id] || {}).count || 0 }))
      .sort((a, b) => b.points - a.points || b.count - a.count || a.m.name.localeCompare(b.m.name));
    if (!rows.length) return `${this._head(title, url)}<div class="empty">Ajoutez les membres de la famille pour lancer le classement.</div>`;
    const max = Math.max(1, rows[0].points);
    const medals = ["🥇", "🥈", "🥉"];
    const out = rows
      .map(
        ({ m, points, count }, i) => `<div class="row" style="--c:${fwColor(m.color)}">
          <span class="medal">${points > 0 && i < 3 ? medals[i] : ""}</span>${this._av(m, true)}
          <span class="grow"><span class="t">${fwEsc(m.name)}</span>
            ${c.show_count ? `<span class="m">${count ? fwPlural(count, "tâche") + " faite" + (count > 1 ? "s" : "") : "Aucune tâche faite"}</span>` : ""}
            <span class="bar"><i style="width:${Math.round((points / max) * 100)}%"></i></span></span>
          <span class="pts">${points} ⭐</span></div>`
      )
      .join("");
    return `${this._head(title, url)}<div class="body">${out}${rows[0].points ? "" : `<div class="empty" style="padding-top:8px">Pas encore de points ${month ? "ce mois-ci" : "cette semaine"}.</div>`}</div>`;
  }
}

/* ---------- Agenda des prochains jours ---------- */

class FoyerAgendaCard extends FoyerWidget {
  static get defaults() {
    return { title: "", member: "", days: 5, max_events: 8 };
  }
  static getStubConfig() {
    return { days: 5 };
  }
  static getConfigForm() {
    return FoyerWidget._form(
      [
        { name: "title", selector: { text: {} } },
        { name: "member", selector: { text: {} } },
        { name: "days", selector: { number: { min: 1, max: 14, mode: "box" } } },
        { name: "max_events", selector: { number: { min: 1, max: 30, mode: "box" } } },
      ],
      { title: "Titre (facultatif)", member: "Membre (« me » : la personne connectée)", days: "Nombre de jours", max_events: "Nombre maximum d'événements" }
    );
  }
  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: 4, min_rows: 2 };
  }

  /* Les répétitions sont dépliées par le serveur, pour la période affichée. */
  async _refresh() {
    this._paintNow();
    const days = Math.max(1, Math.min(14, Number(this._config.days) || 5));
    const seq = (this._seq = (this._seq || 0) + 1);
    const res = await this._call({ type: "foyer_malin/events/range", start: this._data.today, end: fwAdd(this._data.today, days - 1) });
    if (seq !== this._seq || !res) return;
    this._events = res.events;
    this._paintNow();
  }

  _body() {
    const c = this._config;
    const member = c.member ? this._member(c.member) : null;
    if (c.member && !member) return `<div class="error">Membre introuvable : ${fwEsc(c.member)}</div>`;
    const today = this._data.today;
    const days = Math.max(1, Math.min(14, Number(c.days) || 5));
    const title = c.title || (member ? `Agenda de ${member.name}` : "Agenda");
    const url = "/foyer-malin?tab=agenda";
    if (!this._events) return `${this._head(title, url)}<div class="empty">Chargement…</div>`;
    let left = Math.max(1, Number(c.max_events) || 8);
    let total = 0;
    let out = "";
    for (let i = 0; i < days; i++) {
      const day = fwAdd(today, i);
      const events = this._events
        .filter((e) => e.start.slice(0, 10) <= day && e.end.slice(0, 10) >= day)
        .filter((e) => !member || !e.members.length || e.members.includes(member.id))
        .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start.localeCompare(b.start));
      total += events.length;
      if (!events.length || left <= 0) continue;
      out += `<div class="day ${i === 0 ? "today" : ""}">${fwEsc(fwDayLabel(day, today))}</div>`;
      for (const e of events.slice(0, left)) {
        out += `<button class="row link" data-url="${fwEsc(url)}" style="--c:${fwColor((this._data.members.find((m) => m.id === e.members[0]) || {}).color || "#6e56cf")}">
          <span class="time">${fwEsc(e.all_day ? "Journée" : fwEventTime(e))}</span>
          <span class="grow"><span class="t">${fwEsc(e.title)}</span>${e.location ? `<span class="m">📍 ${fwEsc(e.location)}</span>` : ""}</span>${this._avs(e.members)}</button>`;
      }
      left -= events.length;
    }
    return `${this._head(title, url, total ? `<span class="badge">${total}</span>` : "")}<div class="body">${out || `<div class="empty"><span class="big">🌤️</span>Rien de prévu ${days > 1 ? `ces ${days} prochains jours` : "aujourd'hui"}</div>`}</div>`;
  }
}

/* ---------- Une liste ---------- */

class FoyerListCard extends FoyerWidget {
  static get defaults() {
    return { list: "", title: "", max_tasks: 8, show_add: true };
  }
  static getStubConfig() {
    return { list: "" };
  }
  static getConfigForm() {
    return FoyerWidget._form(
      [
        { name: "list", selector: { text: {} } },
        { name: "title", selector: { text: {} } },
        { name: "max_tasks", selector: { number: { min: 1, max: 40, mode: "box" } } },
        { name: "show_add", selector: { boolean: {} } },
      ],
      { list: "Liste (nom)", title: "Titre (facultatif)", max_tasks: "Nombre maximum de tâches", show_add: "Champ « Ajouter »" }
    );
  }
  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: 4, min_rows: 2 };
  }

  _body() {
    const c = this._config;
    if (!c.list) {
      const names = this._data.lists.map((l) => l.name).join(", ");
      return `<div class="error">Choisissez une liste${names ? ` : ${fwEsc(names)}` : " (créez-en une dans Foyer Malin)"}.</div>`;
    }
    const list = this._list(c.list);
    if (!list) return `<div class="error">Liste introuvable : ${fwEsc(c.list)}</div>`;
    const color = fwColor(list.color);
    const tasks = this._sortTasks(this._data.tasks.filter((t) => t.list_id === list.id && !t.done));
    const shown = tasks.slice(0, Math.max(1, Number(c.max_tasks) || 8));
    const url = "/foyer-malin?tab=lists";
    return `<div style="--lc:${color};display:flex;flex-direction:column;flex:1">
      <div class="lhead"><span class="e">${fwEsc(list.emoji)}</span><button class="title" data-url="${url}">${fwEsc(c.title || list.name)}</button>${tasks.length ? `<span class="badge">${tasks.length}</span>` : ""}</div>
      <div class="body" style="padding-top:6px">${
        shown.length ? shown.map((t) => this._taskRow(t, { color })).join("") : `<div class="empty"><span class="big">✨</span>Rien à faire dans cette liste</div>`
      }${tasks.length > shown.length ? `<button class="more" data-url="${url}">et ${tasks.length - shown.length} de plus</button>` : ""}</div>
      ${c.show_add ? `<div class="addrow"><input name="add" placeholder="Ajouter une tâche" enterkeyhint="done" data-enter="add" aria-label="Ajouter une tâche à ${fwEsc(list.name)}"></div>` : ""}</div>`;
  }

  async _act(action, el) {
    if (action !== "add") return super._act(action, el);
    const title = el.value.trim();
    const list = this._list(this._config.list);
    if (!title || !list) return;
    el.value = "";
    await this._call({ type: "foyer_malin/tasks/save", task: { title, list_id: list.id } });
  }
}

/* ---------- Les membres de la famille ---------- */

class FoyerMembersCard extends FoyerWidget {
  static get defaults() {
    return { title: "Famille", show_points: true };
  }
  static getStubConfig() {
    return {};
  }
  static getConfigForm() {
    return FoyerWidget._form(
      [{ name: "title", selector: { text: {} } }, { name: "show_points", selector: { boolean: {} } }],
      { title: "Titre", show_points: "Afficher les points du mois" }
    );
  }
  getGridOptions() {
    return { columns: 6, min_columns: 3, rows: 3, min_rows: 2 };
  }

  _body() {
    const c = this._config;
    const today = this._data.today;
    const showPoints = c.show_points && this._data.settings.points;
    if (!this._data.members.length) return `${this._head(c.title, "/foyer-malin?tab=family")}<div class="empty">Ajoutez les membres de la famille dans Foyer Malin.</div>`;
    const rows = this._data.members
      .map((m) => {
        const due = this._data.tasks.filter((t) => !t.done && t.due && t.due <= today && t.assignees.includes(m.id));
        const late = due.filter((t) => fwLate(t, today)).length;
        const points = ((this._data.scores_month || {})[m.id] || {}).points || 0;
        return `<button class="row link" style="--c:${fwColor(m.color)}" data-url="/foyer-malin?tab=tasks&member=${fwEsc(m.id)}">
          ${this._av(m, true)}<span class="grow"><span class="t">${fwEsc(m.name)}</span>
          <span class="m">${due.length ? `${fwPlural(due.length, "tâche")} aujourd'hui${late ? ` · ${late} en retard` : ""}` : "Tout est fait 🎉"}</span></span>
          ${showPoints ? `<span class="pts">${points} ⭐</span>` : ""}</button>`;
      })
      .join("");
    return `${this._head(c.title, "/foyer-malin?tab=family")}<div class="body">${rows}</div>`;
  }
}

/* ---------- Déclaration des cartes ---------- */

for (const [tag, cls, name, description] of [
  ["foyer-malin-tasks-card", FoyerTasksCard, "Foyer Malin – Tâches du jour", "Les tâches à faire aujourd'hui (ou de la semaine), pour la famille, un membre ou une liste, à cocher directement."],
  ["foyer-malin-ranking-card", FoyerRankingCard, "Foyer Malin – Top points du mois", "Le classement des points de la famille, du mois ou de la semaine."],
  ["foyer-malin-agenda-card", FoyerAgendaCard, "Foyer Malin – Agenda", "Les événements des prochains jours, jour par jour."],
  ["foyer-malin-list-card", FoyerListCard, "Foyer Malin – Une liste", "Les tâches d'une liste (jardin, ménage…), avec un champ pour en ajouter."],
  ["foyer-malin-members-card", FoyerMembersCard, "Foyer Malin – La famille", "Chaque membre avec ses tâches du jour et ses points du mois."],
]) {
  if (customElements.get(tag)) continue;
  customElements.define(tag, cls);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: tag, name, description, preview: true, documentationURL: "https://github.com/olabagency/foyer-malin#widgets-du-tableau-de-bord" });
}
