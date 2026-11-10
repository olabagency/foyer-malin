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
