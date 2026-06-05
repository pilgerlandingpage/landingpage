const AGENT_OFFICE_CSS = `
.agent-office {
  display: grid;
  gap: 18px;
}

.agent-office-roster-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.05);
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
}

.agent-office-roster-head {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(280px, 420px) auto;
  justify-content: space-between;
}

.agent-office-search.agent-office-roster-search {
  background: #fff;
  border-color: var(--border);
  color: var(--text-muted);
  min-width: 0;
}

.agent-office-search.agent-office-roster-search input {
  color: var(--text-primary);
}

.agent-office-search.agent-office-roster-search input::placeholder {
  color: var(--text-muted);
}

.agent-office-roster-summary {
  align-items: center;
  background: rgba(201,169,110,0.1);
  border: 1px solid rgba(201,169,110,0.22);
  border-radius: 999px;
  color: var(--gold-dark);
  display: inline-flex;
  gap: 8px;
  justify-content: center;
  justify-self: end;
  min-height: 38px;
  padding: 8px 12px;
  white-space: nowrap;
}

.agent-office-roster-summary strong {
  color: var(--text-primary);
  font-family: 'Playfair Display', serif;
  font-size: 1.24rem;
  line-height: 1;
}

.agent-office-roster-summary span {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.agent-office-command {
  align-items: stretch;
  background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(249,246,239,0.78));
  border: 1px solid rgba(201,169,110,0.22);
  border-radius: 16px;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.72fr);
  padding: 18px;
}

.agent-office-command h2,
.agent-office-detail-head h2,
.agent-office-prompt-head h3 {
  align-items: center;
  color: var(--text-primary);
  display: flex;
  gap: 8px;
  margin: 0;
}

.agent-office-command p,
.agent-office-detail-head p,
.agent-office-prompt-head p {
  color: var(--text-muted);
  line-height: 1.45;
  margin: 8px 0 0;
}

.agent-office-command-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.agent-office-command-grid div {
  background: rgba(18,18,18,0.04);
  border: 1px solid rgba(18,18,18,0.06);
  border-radius: 12px;
  display: grid;
  gap: 4px;
  padding: 12px;
}

.agent-office-command-grid strong {
  color: var(--text-primary);
  font-family: 'Playfair Display', serif;
  font-size: 1.55rem;
}

.agent-office-command-grid span {
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
}

.agent-office-shell {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  min-height: 720px;
  overflow: hidden;
}

.agent-office-shell-expanded {
  grid-template-columns: 1fr;
  min-height: 0;
}

.agent-office-sidebar {
  background: linear-gradient(180deg, rgba(18,18,18,0.96), rgba(40,34,27,0.96));
  border-right: 1px solid rgba(201,169,110,0.22);
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px;
}

.agent-office-search {
  align-items: center;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  color: rgba(255,255,255,0.62);
  display: flex;
  gap: 8px;
  padding: 10px 12px;
}

.agent-office-search input {
  background: transparent;
  border: 0;
  color: #fff;
  font: inherit;
  min-width: 0;
  outline: none;
  width: 100%;
}

.agent-office-search input::placeholder {
  color: rgba(255,255,255,0.45);
}

.agent-office-sectors {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.agent-office-sectors button,
.agent-office-list button {
  appearance: none;
  border: 0;
  cursor: pointer;
  font: inherit;
}

.agent-office-sectors button {
  align-items: center;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  color: rgba(255,255,255,0.72);
  display: flex;
  font-size: 0.72rem;
  font-weight: 900;
  gap: 8px;
  justify-content: space-between;
  padding: 8px 10px;
}

.agent-office-sectors button.active {
  background: var(--gold);
  border-color: var(--gold);
  color: #111;
}

.agent-office-sectors strong {
  font-size: 0.72rem;
}

.agent-office-sector-rail {
  display: flex;
  gap: 8px;
  margin-top: 0;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}

.agent-office-sector-rail button {
  background: #f8f4ec;
  border: 1px solid rgba(201,169,110,0.2);
  color: var(--text-secondary);
  flex: 0 0 auto;
  min-height: 34px;
  padding: 7px 11px;
}

.agent-office-sector-rail button.active {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: #fff;
}

.agent-office-list {
  display: grid;
  gap: 9px;
  margin-top: 16px;
  overflow: auto;
  padding-right: 3px;
}

.agent-office-list button {
  align-items: center;
  background: rgba(255,255,255,0.075);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  color: rgba(255,255,255,0.78);
  display: grid;
  gap: 10px;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  padding: 12px;
  text-align: left;
}

.agent-office-list button.active {
  background: rgba(201,169,110,0.18);
  border-color: rgba(201,169,110,0.54);
  color: #fff;
}

.agent-office-list strong,
.agent-office-list small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-office-list strong {
  font-size: 0.86rem;
}

.agent-office-list small {
  color: rgba(255,255,255,0.5);
  font-size: 0.72rem;
  margin-top: 3px;
}

.agent-office-agent-rail {
  display: flex;
  gap: 10px;
  margin-top: 0;
  overflow-x: auto;
  padding: 2px 2px 8px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.agent-office-agent-rail button {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  color: var(--text-primary);
  flex: 0 0 220px;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  min-height: 72px;
  scroll-snap-align: start;
}

.agent-office-agent-rail button.active {
  background: linear-gradient(135deg, rgba(201,169,110,0.18), rgba(255,255,255,0.96));
  border-color: rgba(201,169,110,0.72);
  box-shadow: 0 16px 34px rgba(201,169,110,0.14);
  color: var(--text-primary);
}

.agent-office-agent-rail small {
  color: var(--text-muted);
}

.agent-office-agent-rail .agent-office-no-results {
  color: var(--text-muted);
  flex: 1 1 auto;
  min-height: 72px;
}

.agent-office-avatar {
  align-items: center;
  aspect-ratio: 1;
  background:
    radial-gradient(circle at 50% 24%, rgba(255,255,255,0.55), transparent 28%),
    linear-gradient(135deg, #c9a96e, #2b2620);
  border: 1px solid rgba(255,255,255,0.26);
  border-radius: 999px;
  box-shadow: inset 0 0 0 4px rgba(0,0,0,0.12), 0 10px 22px rgba(0,0,0,0.18);
  color: #fff;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 0.82rem;
  font-weight: 950;
  justify-content: center;
  letter-spacing: 0.04em;
  overflow: hidden;
  position: relative;
  width: 42px;
}

.agent-office-avatar::before {
  background: rgba(255,255,255,0.18);
  border-radius: 999px 999px 34px 34px;
  bottom: -4px;
  content: "";
  height: 48%;
  left: 20%;
  position: absolute;
  right: 20%;
}

.agent-office-avatar::after {
  border: 2px solid rgba(255,255,255,0.45);
  border-radius: inherit;
  content: "";
  inset: 4px;
  position: absolute;
}

.agent-office-avatar > span {
  position: relative;
  z-index: 1;
}

.agent-office-avatar img {
  height: 100%;
  inset: 0;
  object-fit: cover;
  position: absolute;
  width: 100%;
  z-index: 2;
}

.agent-office-avatar:has(img)::before {
  content: none;
}

.agent-office-avatar-noir { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #c9a96e, #121212); }
.agent-office-avatar-graphite { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #9ca3af, #1f2937); }
.agent-office-avatar-emerald { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #34d399, #064e3b); }
.agent-office-avatar-champagne { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #f2d59b, #7c5c24); }
.agent-office-avatar-aqua { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #67e8f9, #0e7490); }
.agent-office-avatar-blue { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #60a5fa, #1e3a8a); }
.agent-office-avatar-rose { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #fb7185, #881337); }
.agent-office-avatar-amber { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #f59e0b, #78350f); }
.agent-office-avatar-lilac { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #c084fc, #581c87); }
.agent-office-avatar-steel { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #94a3b8, #334155); }
.agent-office-avatar-magenta { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #f472b6, #831843); }
.agent-office-avatar-sunset { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #fb923c, #7c2d12); }
.agent-office-avatar-olive { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #a3e635, #365314); }
.agent-office-avatar-royal { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #818cf8, #312e81); }
.agent-office-avatar-teal { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #2dd4bf, #134e4a); }
.agent-office-avatar-broker { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #d6b36f, #1c1917); }
.agent-office-avatar-gold { background: radial-gradient(circle at 50% 24%, rgba(255,255,255,0.5), transparent 28%), linear-gradient(135deg, #c9a96e, #3a2d1b); }

.agent-office-avatar[data-status="success"] {
  outline: 2px solid rgba(34,197,94,0.48);
  outline-offset: 2px;
}

.agent-office-no-results,
.agent-office-empty {
  align-items: center;
  border: 1px dashed rgba(201,169,110,0.3);
  border-radius: 14px;
  color: var(--text-muted);
  display: flex;
  gap: 8px;
  justify-content: center;
  min-height: 110px;
  padding: 18px;
  text-align: center;
}

.agent-office-no-results {
  color: rgba(255,255,255,0.56);
}

.agent-office-detail {
  display: grid;
  gap: 12px;
  align-content: start;
  grid-auto-rows: auto;
  min-width: 0;
  padding: 16px;
}

.agent-office-detail-head {
  align-items: flex-start;
  display: flex;
  gap: 14px;
  justify-content: space-between;
}

.agent-office-person-card {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr);
  min-width: 0;
}

.agent-office-person-card .agent-office-avatar {
  font-size: 1.05rem;
  width: 64px;
}

.agent-office-person-card strong {
  color: var(--gold-dark);
  display: block;
  font-size: 0.82rem;
  margin: 3px 0 5px;
}

.agent-office-avatar-upload {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.agent-office-avatar-upload label {
  align-items: center;
  background: #111;
  border: 1px solid rgba(201,169,110,0.34);
  border-radius: 999px;
  color: #f8f3e8;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 900;
  gap: 7px;
  min-height: 34px;
  padding: 8px 12px;
  text-transform: uppercase;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.agent-office-avatar-upload label:hover {
  background: #1c1917;
  border-color: var(--gold);
  transform: translateY(-1px);
}

.agent-office-avatar-upload label.is-disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}

.agent-office-avatar-upload input {
  display: none;
}

.agent-office-status {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 0.72rem;
  font-weight: 900;
  gap: 7px;
  padding: 8px 11px;
  text-transform: uppercase;
}

.agent-office-profile-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.agent-office-profile-grid div {
  background: linear-gradient(135deg, rgba(249,246,239,0.82), rgba(255,255,255,0.96));
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 12px;
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px 10px;
}

.agent-office-profile-grid span {
  color: var(--text-muted);
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.agent-office-profile-grid strong {
  color: var(--text-primary);
  font-size: 0.78rem;
  line-height: 1.28;
}

.agent-office-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-office-tools span {
  align-items: center;
  background: rgba(18,18,18,0.04);
  border: 1px solid rgba(18,18,18,0.06);
  border-radius: 999px;
  color: var(--text-secondary);
  display: inline-flex;
  font-size: 0.68rem;
  font-weight: 800;
  gap: 5px;
  padding: 5px 8px;
}

.agent-office-prompt-card {
  border: 1px solid rgba(201,169,110,0.22);
  border-radius: 16px;
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr) auto;
  min-height: 0;
  overflow: hidden;
}

.agent-office-prompt-card.has-tags {
  grid-template-rows: auto auto minmax(360px, 1fr) auto;
}

.agent-office-behavior-card {
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  overflow: visible;
}

.agent-office-central-card {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  box-shadow: 0 16px 44px rgba(15,23,42,0.04);
  overflow: hidden;
}

.agent-office-central-status {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 0.66rem;
  font-weight: 950;
  justify-content: center;
  min-height: 30px;
  padding: 7px 10px;
  text-transform: uppercase;
  white-space: nowrap;
}

.agent-office-central-status.full {
  background: rgba(16,185,129,0.12);
  color: #047857;
}

.agent-office-central-status.contracted {
  background: rgba(201,169,110,0.18);
  color: #8a6420;
}

.agent-office-central-status.partial {
  background: rgba(245,158,11,0.14);
  color: #92400e;
}

.agent-office-central-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 14px;
}

.agent-office-central-grid div {
  background: linear-gradient(135deg, rgba(249,246,239,0.78), rgba(255,255,255,0.94));
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 12px;
  min-width: 0;
  padding: 11px;
}

.agent-office-central-grid span {
  color: var(--gold-dark);
  display: block;
  font-size: 0.65rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.agent-office-central-grid p {
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 800;
  line-height: 1.45;
  margin: 0;
}

.agent-office-topic-bank {
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  overflow: hidden;
}

.agent-office-email-bank {
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  overflow: hidden;
}

.agent-office-email-ownership {
  align-items: stretch;
  background:
    linear-gradient(135deg, rgba(24,24,24,0.95), rgba(47,40,32,0.94)),
    radial-gradient(circle at top right, rgba(201,169,110,0.16), transparent 48%);
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(170px, 0.5fr));
  padding: 14px;
}

.agent-office-email-ownership > div {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 12px;
}

.agent-office-email-ownership strong {
  color: #fff;
  display: block;
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.2;
}

.agent-office-email-ownership p {
  color: rgba(255,255,255,0.72);
  font-size: 0.78rem;
  line-height: 1.5;
  margin: 6px 0 0;
}

.agent-office-email-ownership span {
  color: var(--gold);
  display: block;
  font-size: 0.64rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  margin-bottom: 7px;
  text-transform: uppercase;
}

.agent-office-email-ownership > div:not(:first-child) strong {
  font-family: var(--font-sans);
  font-size: 0.86rem;
}

.agent-office-event-card {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  box-shadow: 0 18px 50px rgba(15,23,42,0.05);
  overflow: hidden;
}

.agent-office-event-body {
  background: linear-gradient(180deg, rgba(249,246,239,0.76), #fff 46%);
  display: grid;
  gap: 14px;
  padding: 14px;
}

.agent-office-event-summary {
  align-items: center;
  background: rgba(255,255,255,0.84);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 14px;
  display: flex;
  gap: 14px;
  justify-content: space-between;
  padding: 12px;
}

.agent-office-event-summary span,
.agent-office-event-section-head span {
  color: var(--text-muted);
  display: block;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.agent-office-event-summary strong {
  color: var(--text-primary);
  display: block;
  font-size: 0.98rem;
  margin-top: 4px;
}

.agent-office-event-summary small {
  color: var(--text-secondary);
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  margin-top: 4px;
}

.agent-office-event-metrics {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.agent-office-event-metrics div {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 12px;
  padding: 10px;
}

.agent-office-event-metrics span {
  color: var(--text-muted);
  display: block;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.agent-office-event-metrics strong {
  color: var(--text-primary);
  display: block;
  font-size: 1.28rem;
  margin-top: 4px;
}

.agent-office-event-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(320px, 1.2fr) minmax(260px, 0.8fr);
}

.agent-office-event-leads,
.agent-office-event-recommendations,
.agent-office-event-ai {
  background: rgba(255,255,255,0.86);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 14px;
  display: grid;
  gap: 10px;
  padding: 12px;
}

.agent-office-event-section-head {
  align-items: flex-start;
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.agent-office-event-section-head strong,
.agent-office-event-ai strong {
  color: var(--gold-dark);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.agent-office-event-lead {
  align-items: center;
  background: rgba(15,23,42,0.03);
  border: 1px solid rgba(148,163,184,0.22);
  border-radius: 12px;
  display: grid;
  gap: 5px 10px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  padding: 10px;
}

.agent-office-event-lead.quente {
  background: rgba(34,197,94,0.08);
  border-color: rgba(34,197,94,0.24);
}

.agent-office-event-lead.morno {
  background: rgba(201,169,110,0.1);
  border-color: rgba(201,169,110,0.28);
}

.agent-office-event-lead strong {
  color: var(--text-primary);
  display: block;
  font-size: 0.88rem;
}

.agent-office-event-lead span,
.agent-office-event-lead p {
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.agent-office-event-lead b {
  color: var(--gold-dark);
  font-size: 1.02rem;
}

.agent-office-event-lead small {
  background: rgba(255,255,255,0.84);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 0.66rem;
  font-weight: 900;
  padding: 5px 7px;
}

.agent-office-event-lead p {
  grid-column: 1 / -1;
  line-height: 1.4;
  margin: 0;
}

.agent-office-event-recommendations div {
  align-items: flex-start;
  background: rgba(249,246,239,0.72);
  border: 1px solid rgba(201,169,110,0.14);
  border-radius: 12px;
  color: var(--text-secondary);
  display: grid;
  font-size: 0.8rem;
  font-weight: 750;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  line-height: 1.45;
  padding: 10px;
}

.agent-office-event-recommendations svg {
  color: var(--gold-dark);
}

.agent-office-event-ai {
  background: linear-gradient(135deg, rgba(15,23,42,0.96), rgba(47,34,15,0.94));
  border-color: rgba(201,169,110,0.3);
}

.agent-office-event-ai strong {
  color: #f5d487;
}

.agent-office-event-ai p {
  color: rgba(255,255,255,0.84);
  font-size: 0.82rem;
  line-height: 1.55;
  margin: 0;
  white-space: pre-wrap;
}

.agent-office-event-automation {
  background: linear-gradient(180deg, rgba(15,23,42,0.02), rgba(249,246,239,0.72));
  border-top: 1px solid rgba(201,169,110,0.18);
  display: grid;
  gap: 14px;
  padding: 14px;
}

.agent-office-event-automation > .agent-office-event-section-head select {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.28);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 800;
  min-height: 38px;
  min-width: min(100%, 320px);
  outline: none;
  padding: 0 10px;
}

.agent-office-event-automation-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

.agent-office-event-rule-builder,
.agent-office-event-rule-list {
  background: rgba(255,255,255,0.88);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 14px;
  display: grid;
  gap: 12px;
  padding: 12px;
}

.agent-office-event-rule-builder {
  min-width: 0;
}

.agent-office-event-message-control textarea {
  min-height: 280px;
}

.agent-office-event-button-editor {
  display: grid;
  gap: 8px;
}

.agent-office-event-button-editor div {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(130px, 0.7fr) minmax(120px, 0.58fr) minmax(160px, 1fr);
}

.agent-office-event-button-editor input {
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.8rem;
  min-height: 38px;
  outline: none;
  padding: 0 10px;
}

.agent-office-event-rule {
  align-items: flex-start;
  background: rgba(249,246,239,0.72);
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 12px;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 11px;
}

.agent-office-event-rule strong {
  color: var(--text-primary);
  display: block;
  font-size: 0.86rem;
}

.agent-office-event-rule span,
.agent-office-event-rule small {
  color: var(--text-muted);
  display: block;
  font-size: 0.72rem;
  font-weight: 800;
  margin-top: 4px;
}

.agent-office-event-rule p {
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.45;
  margin: 8px 0 0;
  white-space: pre-line;
}

.agent-office-event-rule > div:last-child {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.agent-office-event-empty {
  align-items: center;
  background: rgba(249,246,239,0.68);
  border: 1px dashed rgba(201,169,110,0.32);
  border-radius: 14px;
  color: var(--text-muted);
  display: flex;
  font-size: 0.82rem;
  font-weight: 800;
  min-height: 96px;
  padding: 16px;
}

.agent-office-event-empty.danger {
  background: rgba(239,68,68,0.06);
  border-color: rgba(239,68,68,0.22);
  color: #b91c1c;
}

.agent-office-notifier-card {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  box-shadow: 0 18px 50px rgba(15,23,42,0.05);
  overflow: hidden;
}

.agent-office-notifier-body {
  background: linear-gradient(180deg, rgba(249,246,239,0.72), #fff 42%);
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(260px, 0.74fr) minmax(360px, 1.26fr);
  padding: 14px;
}

.agent-office-notifier-sector-card .sector-compact-summary {
  margin-top: 0;
}

.agent-office-notifier-section-head {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.agent-office-notifier-section-head strong {
  color: var(--gold-dark);
  display: block;
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.agent-office-notifier-section-head p {
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.45;
  margin: 4px 0 0;
}

.agent-office-notifier-members {
  display: grid;
  gap: 10px;
}

.agent-office-notifier-member {
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 12px;
  display: grid;
  gap: 9px;
  padding: 10px;
}

.agent-office-notifier-member-fields {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(170px, 0.9fr) minmax(170px, 1fr) 38px;
}

.agent-office-notifier-member-fields input {
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.8rem;
  height: 38px;
  outline: none;
  padding: 8px 10px;
  width: 100%;
}

.agent-office-notifier-remove {
  align-items: center;
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(239,68,68,0.24);
  border-radius: 10px;
  color: #b91c1c;
  cursor: pointer;
  display: inline-flex;
  height: 38px;
  justify-content: center;
  width: 38px;
}

.agent-office-notifier-tag-label {
  color: var(--text-muted);
  display: block;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  margin-bottom: 7px;
  text-transform: uppercase;
}

.agent-office-notifier-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.agent-office-notifier-tags button {
  background: rgba(255,255,255,0.76);
  border: 1px solid rgba(201,169,110,0.2);
  border-radius: 999px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 6px 10px;
}

.agent-office-notifier-tags button.active {
  background: rgba(201,169,110,0.18);
  border-color: rgba(201,169,110,0.68);
  color: var(--text-primary);
}

.agent-office-notifier-actions {
  background: #fff;
  border-top: 1px solid rgba(201,169,110,0.16);
}

.agent-office-broker-card {
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 50px rgba(15,23,42,0.05);
  overflow: hidden;
}

.agent-office-broker-body {
  background: linear-gradient(180deg, rgba(249,246,239,0.72), #fff 42%);
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  padding: 14px;
}

.agent-office-broker-strip {
  align-items: center;
  background: rgba(14,165,233,0.07);
  border: 1px solid rgba(14,165,233,0.18);
  border-radius: 12px;
  color: #0369a1;
  display: grid;
  gap: 4px 8px;
  grid-column: 1 / -1;
  grid-template-columns: 22px minmax(0, auto) minmax(0, 1fr);
  padding: 9px 12px;
}

.agent-office-broker-strip.connected {
  background: rgba(34,197,94,0.09);
  border-color: rgba(34,197,94,0.2);
  color: #166534;
}

.agent-office-broker-strip svg {
  grid-row: span 2;
}

.agent-office-broker-strip strong {
  font-size: 0.82rem;
}

.agent-office-broker-strip span {
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.agent-office-broker-body .agent-office-control-group {
  background: rgba(255,255,255,0.84);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.78);
}

.agent-office-broker-body > .agent-office-control-group:nth-child(2) {
  grid-column: 1 / -1;
}

.agent-office-broker-body > .agent-office-control-group:nth-child(3) {
  grid-column: 1 / -1;
}

.agent-office-broker-body > .agent-office-control-group:nth-child(4) {
  grid-column: 1 / span 6;
}

.agent-office-broker-body > .agent-office-control-group:nth-child(5) {
  grid-column: 7 / -1;
}

.agent-office-broker-body > .agent-office-control-group:nth-child(6) {
  grid-column: 1 / -1;
}

.agent-office-broker-body > .agent-office-assistant-section {
  grid-column: 1 / -1;
}

.agent-office-broker-body > .agent-office-control-group:nth-child(2) .agent-office-control-grid {
  grid-template-columns: minmax(180px, 1.2fr) minmax(130px, 0.75fr) minmax(150px, 0.8fr) minmax(260px, 1.5fr);
}

.agent-office-broker-body > .agent-office-control-group:nth-child(2) .agent-office-control-wide {
  grid-column: 1 / -1;
}

.agent-office-loading-inline {
  align-items: center;
  background: #fff;
  color: var(--text-secondary);
  display: flex;
  font-size: 0.82rem;
  font-weight: 800;
  gap: 8px;
  min-height: 92px;
  padding: 18px;
}

.agent-office-prompt-head {
  align-items: flex-start;
  background: rgba(249,246,239,0.72);
  border-bottom: 1px solid rgba(201,169,110,0.18);
  display: flex;
  gap: 14px;
  justify-content: space-between;
  padding: 14px;
}

.agent-office-runtime-grid,
.agent-office-control-grid {
  align-items: start;
  display: grid;
  gap: 8px;
}

.agent-office-runtime-grid {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  padding: 9px 10px;
}

.agent-office-control-grid {
  grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
}

.agent-office-runtime-grid {
  background: #fff;
  border-bottom: 1px solid rgba(201,169,110,0.14);
}

.agent-office-control-groups {
  background: #fff;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(360px, 1fr) minmax(260px, 0.82fr);
  padding: 9px 10px;
}

.agent-office-blog-control-groups {
  grid-template-columns: minmax(230px, 320px) minmax(700px, 1fr);
}

.agent-office-email-control-groups {
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.92fr) minmax(220px, 0.58fr);
}

.agent-office-email-control-groups .agent-office-control-grid {
  grid-template-columns: repeat(auto-fit, minmax(102px, 1fr));
}

.agent-office-control-group {
  align-content: start;
  background: rgba(249,246,239,0.58);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.agent-office-control-group > strong {
  color: var(--gold-dark);
  font-size: 0.64rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.agent-office-runtime-grid div,
.agent-office-control {
  background: rgba(255,255,255,0.94);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 9px;
  display: grid;
  gap: 5px;
  padding: 8px;
}

.agent-office-control {
  align-content: start;
  min-height: 0;
  padding: 7px;
}

.agent-office-runtime-grid span,
.agent-office-control span {
  color: var(--text-muted);
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.agent-office-runtime-grid strong {
  color: var(--text-primary);
  font-size: 0.8rem;
}

.agent-office-runtime-grid .pilger-ai-tone-danger strong {
  color: #dc2626;
}

.agent-office-control input,
.agent-office-control select,
.agent-office-control textarea {
  align-self: start;
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 9px;
  color: var(--text-primary);
  font-size: 0.78rem;
  height: 34px;
  min-height: 34px;
  outline: none;
  padding: 7px 9px;
  width: 100%;
}

.agent-office-control-label {
  align-items: center;
  display: flex;
  gap: 6px;
  justify-content: space-between;
  min-width: 0;
}

.agent-office-control-label > span:first-child {
  min-width: 0;
}

.agent-office-help {
  align-items: center;
  background: rgba(18,18,18,0.04);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 999px;
  color: var(--text-muted) !important;
  cursor: help;
  display: inline-flex;
  flex: 0 0 auto;
  height: 18px;
  justify-content: center;
  letter-spacing: 0 !important;
  position: relative;
  text-transform: none !important;
  width: 18px;
}

.agent-office-help:hover,
.agent-office-help:focus {
  background: rgba(184,145,83,0.14);
  border-color: rgba(184,145,83,0.3);
  color: var(--gold-dark) !important;
  outline: none;
}

.agent-office-help:hover::after,
.agent-office-help:focus::after {
  background: #151515;
  border: 1px solid rgba(201,169,110,0.22);
  border-radius: 10px;
  bottom: calc(100% + 8px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.18);
  color: #fff;
  content: attr(data-help);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
  padding: 9px 10px;
  position: absolute;
  right: -4px;
  text-transform: none;
  width: 240px;
  z-index: 30;
}

.agent-office-help:hover::before,
.agent-office-help:focus::before {
  border: 6px solid transparent;
  border-top-color: #151515;
  bottom: calc(100% - 3px);
  content: "";
  position: absolute;
  right: 2px;
  z-index: 31;
}

.agent-office-control textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  height: auto;
  line-height: 1.5;
  min-height: 116px;
  resize: vertical;
}

.agent-office-control-wide {
  grid-column: 1 / -1;
}

.agent-office-blog-schedule-group {
  min-width: 0;
}

.agent-office-blog-control-groups > .agent-office-control-group:not(.agent-office-blog-schedule-group) {
  gap: 9px;
  padding: 12px;
}

.agent-office-blog-control-groups > .agent-office-control-group:not(.agent-office-blog-schedule-group) .agent-office-control-grid {
  grid-template-columns: 1fr;
}

.agent-office-blog-control-groups > .agent-office-control-group:not(.agent-office-blog-schedule-group) .agent-office-control {
  padding: 8px;
}

.agent-office-blog-control-groups > .agent-office-control-group:not(.agent-office-blog-schedule-group) .agent-office-control select {
  height: 34px;
  min-height: 34px;
  padding: 7px 9px;
}

.agent-office-blog-schedule {
  display: grid;
  gap: 9px;
}

.agent-office-blog-days {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(7, minmax(36px, 1fr));
}

.agent-office-blog-days button {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(18,18,18,0.1);
  border-radius: 999px;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.66rem;
  font-weight: 950;
  height: 32px;
  justify-content: center;
  letter-spacing: 0.02em;
  min-width: 0;
  padding: 0 6px;
}

.agent-office-blog-days button.active {
  background: linear-gradient(135deg, #d8b979, #b89153);
  border-color: rgba(184,145,83,0.45);
  color: #1f1608;
}

.agent-office-blog-days button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.agent-office-blog-times {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(auto-fit, minmax(94px, 1fr));
}

.agent-office-blog-times .agent-office-control {
  gap: 5px;
  padding: 7px;
}

.agent-office-blog-times .agent-office-control input {
  font-size: 0.74rem;
  height: 34px;
  min-height: 34px;
  padding: 7px 8px;
}

.agent-office-voice-preview {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(180px, 1fr) auto;
}

.agent-office-voice-control {
  align-items: end;
  grid-template-columns: minmax(220px, 0.75fr) minmax(320px, 1.25fr);
}

.agent-office-voice-control > span {
  grid-column: 1 / -1;
}

.agent-office-voice-control > select {
  grid-column: 1;
  grid-row: 2;
}

.agent-office-voice-control > .agent-office-voice-preview {
  grid-column: 2;
  grid-row: 2;
}

.agent-office-voice-control > small {
  grid-column: 1 / -1;
}

.agent-office-voice-preview input {
  height: 36px;
  min-height: 36px;
}

.agent-office-voice-preview button {
  align-items: center;
  background: rgba(201,169,110,0.12);
  border: 1px solid rgba(201,169,110,0.28);
  border-radius: 10px;
  color: var(--gold-dark);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.76rem;
  font-weight: 900;
  gap: 7px;
  justify-content: center;
  min-height: 36px;
  padding: 7px 10px;
}

.agent-office-voice-preview button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.agent-office-voice-preview audio {
  grid-column: 1 / -1;
  height: 34px;
  width: min(100%, 460px);
}

.agent-office-error-text {
  color: #dc2626 !important;
}

.agent-office-toggle {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  min-height: 38px;
  padding: 7px 9px;
  text-align: left;
}

.agent-office-toggle.active {
  background: rgba(34,197,94,0.09);
  border-color: rgba(34,197,94,0.24);
  color: #166534;
}

.agent-office-toggle strong {
  background: rgba(18,18,18,0.06);
  border-radius: 999px;
  color: inherit;
  font-size: 0.66rem;
  padding: 5px 8px;
  text-transform: uppercase;
}

.agent-office-inline-button {
  justify-self: start;
}

.agent-office-assistant-compact {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.agent-office-assistant-compact input {
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.8rem;
  height: 38px;
  outline: none;
  padding: 8px 10px;
  width: 100%;
}

.agent-office-assistant-compact button {
  align-items: center;
  background: rgba(201,169,110,0.12);
  border: 1px solid rgba(201,169,110,0.28);
  border-radius: 10px;
  color: var(--gold-dark);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.78rem;
  font-weight: 900;
  gap: 6px;
  height: 38px;
  justify-content: center;
  min-height: 38px;
  padding: 8px 11px;
}

.agent-office-concierge-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
}

.agent-office-assistant-list {
  display: grid;
  gap: 10px;
}

.agent-office-assistant-empty {
  background: rgba(18,18,18,0.035);
  border: 1px dashed rgba(18,18,18,0.14);
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 800;
  padding: 12px;
}

.agent-office-assistant-card {
  background: rgba(255,255,255,0.86);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.agent-office-assistant-fields {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.agent-office-permission-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
}

.agent-office-permission-grid button {
  background: #fff;
  border: 1px solid rgba(18,18,18,0.1);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  gap: 2px;
  min-height: 44px;
  padding: 7px 9px;
  text-align: left;
}

.agent-office-permission-grid button.active {
  background: rgba(34,197,94,0.09);
  border-color: rgba(34,197,94,0.25);
  color: #166534;
}

.agent-office-permission-grid button span {
  font-size: 0.72rem;
  font-weight: 950;
}

.agent-office-permission-grid button small {
  color: inherit;
  font-size: 0.64rem;
  font-weight: 800;
  opacity: 0.72;
}

.agent-office-assistant-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-office-assistant-chips small {
  color: var(--text-muted);
  font-size: 0.74rem;
}

.agent-office-assistant-chips span {
  align-items: center;
  background: rgba(18,18,18,0.04);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 999px;
  color: var(--text-secondary);
  display: inline-flex;
  font-size: 0.74rem;
  font-weight: 800;
  gap: 6px;
  min-height: 28px;
  padding: 4px 5px 4px 9px;
}

.agent-office-assistant-chips button {
  align-items: center;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.14);
  border-radius: 999px;
  color: #dc2626;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.8rem;
  font-weight: 900;
  height: 20px;
  justify-content: center;
  line-height: 1;
  width: 20px;
}

.agent-office-concierge-queue {
  background: rgba(255,255,255,0.74);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 12px;
  display: grid;
  gap: 10px;
  padding: 10px;
}

.agent-office-concierge-queue-head {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.agent-office-concierge-queue-head div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.agent-office-concierge-queue-head span {
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 950;
  text-transform: uppercase;
}

.agent-office-concierge-queue-head small {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.agent-office-concierge-queue-head button,
.agent-office-concierge-links button,
.agent-office-concierge-links a {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(18,18,18,0.1);
  border-radius: 999px;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.7rem;
  font-weight: 900;
  gap: 5px;
  justify-content: center;
  min-height: 30px;
  padding: 6px 10px;
  text-decoration: none;
}

.agent-office-concierge-queue-head button:disabled,
.agent-office-concierge-links button:disabled {
  cursor: not-allowed;
  opacity: 0.64;
}

.agent-office-concierge-summary,
.agent-office-concierge-links,
.agent-office-concierge-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-office-concierge-status {
  align-items: center;
  background: rgba(18,18,18,0.04);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 999px;
  color: var(--text-secondary);
  display: inline-flex;
  font-size: 0.67rem;
  font-weight: 950;
  gap: 6px;
  min-height: 26px;
  padding: 5px 8px;
  text-transform: uppercase;
}

.agent-office-concierge-status strong {
  color: inherit;
  font-size: 0.68rem;
}

.agent-office-concierge-status.pending {
  background: rgba(201,169,110,0.14);
  border-color: rgba(201,169,110,0.28);
  color: var(--gold-dark);
}

.agent-office-concierge-status.success {
  background: rgba(34,197,94,0.1);
  border-color: rgba(34,197,94,0.24);
  color: #166534;
}

.agent-office-concierge-status.danger {
  background: rgba(239,68,68,0.09);
  border-color: rgba(239,68,68,0.22);
  color: #b91c1c;
}

.agent-office-concierge-status.muted {
  background: rgba(18,18,18,0.04);
  border-color: rgba(18,18,18,0.08);
  color: var(--text-muted);
}

.agent-office-concierge-list {
  display: grid;
  gap: 8px;
}

.agent-office-concierge-item {
  background: #fff;
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.agent-office-concierge-item-main {
  align-items: flex-start;
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.agent-office-concierge-item-main div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.agent-office-concierge-item-main strong {
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 950;
}

.agent-office-concierge-item-main span:not(.agent-office-concierge-status) {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 800;
}

.agent-office-concierge-item-meta span {
  background: rgba(18,18,18,0.035);
  border: 1px solid rgba(18,18,18,0.06);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 800;
  padding: 5px 8px;
}

.agent-office-concierge-note {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.35;
}

.agent-office-concierge-empty {
  align-items: center;
  background: rgba(18,18,18,0.035);
  border: 1px dashed rgba(18,18,18,0.14);
  border-radius: 12px;
  color: var(--text-muted);
  display: flex;
  font-size: 0.76rem;
  font-weight: 850;
  gap: 7px;
  padding: 12px;
}

.agent-office-concierge-empty.danger {
  background: rgba(239,68,68,0.06);
  border-color: rgba(239,68,68,0.18);
  color: #b91c1c;
}

.agent-office-concierge-links button {
  background: rgba(239,68,68,0.06);
  border-color: rgba(239,68,68,0.16);
  color: #b91c1c;
}

.agent-office-choice-grid,
.agent-office-check-list {
  display: grid;
  gap: 8px;
}

.agent-office-choice-grid {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  grid-template-columns: none;
}

.agent-office-choice-grid button,
.agent-office-check-list button {
  background: #fff;
  border: 1px solid rgba(18,18,18,0.1);
  border-radius: 12px;
  color: var(--text-primary);
  cursor: pointer;
  display: grid;
  gap: 4px;
  padding: 10px;
  text-align: left;
}

.agent-office-choice-grid button {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  gap: 6px;
  min-height: 32px;
  padding: 6px 10px;
}

.agent-office-choice-grid button svg {
  color: var(--gold-dark);
  height: 14px;
  margin-top: 0;
  width: 14px;
}

.agent-office-choice-grid button span {
  font-size: 0.76rem;
  font-weight: 900;
  white-space: nowrap;
}

.agent-office-check-list button span {
  font-size: 0.82rem;
  font-weight: 900;
}

.agent-office-choice-grid button small {
  display: none;
}

.agent-office-check-list button small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.agent-office-choice-grid button.active,
.agent-office-check-list button.active {
  background: rgba(201,169,110,0.12);
  border-color: rgba(201,169,110,0.48);
}

.agent-office-check-list {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.agent-office-broker-body > .agent-office-control-group:nth-child(6) .agent-office-check-list {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  max-height: 280px;
  overflow: auto;
  padding-right: 4px;
}

.agent-office-broker-body > .agent-office-control-group:nth-child(6) .agent-office-check-list button {
  min-height: 54px;
  padding: 9px 10px;
}

.agent-office-multi-control {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-office-multi-control button {
  appearance: none;
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 999px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 900;
  min-height: 30px;
  padding: 6px 8px;
}

.agent-office-multi-control button.active {
  background: var(--gold);
  border-color: var(--gold);
  color: #111;
}

.agent-office-control small {
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.35;
}

.agent-office-behavior-card .agent-office-prompt-head {
  padding: 12px 14px;
}

.agent-office-topic-create,
.agent-office-topic-row {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
}

.agent-office-topic-create {
  background: rgba(255,255,255,0.76);
  border-bottom: 1px solid rgba(201,169,110,0.14);
  grid-template-columns: minmax(220px, 1.5fr) minmax(180px, 1fr) 120px auto;
}

.agent-office-topic-list {
  background: #fff;
  display: grid;
  gap: 8px;
  padding: 12px 14px;
}

.agent-office-topic-row {
  align-items: center;
  background: rgba(249,246,239,0.58);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 12px;
  grid-template-columns: minmax(180px, 1.35fr) minmax(150px, 0.9fr) 96px 86px 104px 82px 34px;
  padding: 9px;
}

.agent-office-topic-create input,
.agent-office-topic-create select,
.agent-office-topic-row input,
.agent-office-topic-row select {
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 10px;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.78rem;
  height: 38px;
  min-width: 0;
  outline: none;
  padding: 8px 10px;
  width: 100%;
}

.agent-office-topic-remove {
  align-items: center;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  color: #dc2626;
  cursor: pointer;
  display: flex;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.agent-office-topic-empty {
  align-items: center;
  border: 1px dashed rgba(201,169,110,0.3);
  border-radius: 12px;
  color: var(--text-muted);
  display: flex;
  font-size: 0.82rem;
  justify-content: center;
  min-height: 82px;
  padding: 16px;
  text-align: center;
}

.agent-office-email-layout {
  background: #fff;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
  padding: 12px 14px;
}

.agent-office-email-builder,
.agent-office-email-list {
  align-content: start;
  background: rgba(249,246,239,0.58);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 14px;
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
}

.agent-office-email-builder > strong,
.agent-office-email-list > strong,
.agent-office-email-tags > strong {
  color: var(--gold-dark);
  font-size: 0.68rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.agent-office-email-tags {
  background: rgba(255,255,255,0.78);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.agent-office-email-tags div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-office-email-tags button {
  background: rgba(14,165,233,0.08);
  border: 1px solid rgba(14,165,233,0.2);
  border-radius: 999px;
  color: #0369a1;
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 900;
  padding: 6px 8px;
}

.agent-office-email-workbench {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(360px, 0.85fr) minmax(420px, 1.15fr);
}

.agent-office-email-workbench.expanded {
  grid-template-columns: minmax(0, 1fr);
}

.agent-office-email-workbench.expanded .agent-office-email-preview {
  display: none;
}

.agent-office-email-html-control textarea {
  font-size: 0.74rem;
  line-height: 1.45;
  min-height: 520px;
}

.agent-office-email-workbench.expanded .agent-office-email-html-control textarea {
  min-height: min(76vh, 780px);
}

.agent-office-email-editor-head {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.agent-office-email-editor-head > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-office-email-editor-head button {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(18,18,18,0.12);
  border-radius: 9px;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.7rem;
  font-weight: 900;
  gap: 5px;
  justify-content: center;
  min-height: 30px;
  padding: 6px 8px;
}

.agent-office-email-editor-head button:hover {
  background: rgba(184,145,83,0.12);
  border-color: rgba(184,145,83,0.28);
  color: var(--gold-dark);
}

.agent-office-email-preview {
  background: rgba(255,255,255,0.96);
  border: 1px solid rgba(18,18,18,0.08);
  border-radius: 12px;
  display: grid;
  grid-template-rows: auto minmax(520px, 1fr);
  min-height: 0;
  overflow: hidden;
}

.agent-office-email-preview-head {
  align-items: flex-start;
  background: linear-gradient(180deg, rgba(249,246,239,0.92), #fff);
  border-bottom: 1px solid rgba(201,169,110,0.16);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 12px;
}

.agent-office-email-preview-head span {
  color: var(--gold-dark);
  display: block;
  font-size: 0.64rem;
  font-weight: 950;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.agent-office-email-preview-head strong {
  color: var(--text-primary);
  display: block;
  font-size: 0.86rem;
  line-height: 1.3;
  margin-top: 4px;
}

.agent-office-email-preview-head small {
  color: var(--text-muted);
  display: block;
  font-size: 0.72rem;
  line-height: 1.35;
  margin-top: 4px;
}

.agent-office-email-preview-head em {
  background: rgba(184,145,83,0.12);
  border: 1px solid rgba(184,145,83,0.22);
  border-radius: 999px;
  color: var(--gold-dark);
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 900;
  padding: 6px 9px;
}

.agent-office-email-preview-actions {
  align-items: flex-end;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 7px;
}

.agent-office-email-preview-actions button {
  background: #fff;
  border: 1px solid rgba(184,145,83,0.24);
  border-radius: 999px;
  color: var(--gold-dark);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 900;
  padding: 6px 9px;
}

.agent-office-email-preview iframe {
  background: #f3f0ea;
  border: 0;
  height: 100%;
  min-height: 520px;
  width: 100%;
}

.agent-office-whatsapp-layout {
  grid-template-columns: minmax(340px, 0.9fr) minmax(280px, 0.55fr);
}

.agent-office-whatsapp-layout .agent-office-email-list {
  grid-column: 1 / -1;
}

.agent-office-whatsapp-preview {
  align-content: start;
  background: rgba(249,246,239,0.58);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 14px;
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
}

.agent-office-whatsapp-preview > strong {
  color: var(--gold-dark);
  font-size: 0.68rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.agent-office-whatsapp-phone {
  background:
    linear-gradient(180deg, rgba(10,128,75,0.08), rgba(255,255,255,0.96)),
    #fff;
  border: 1px solid rgba(10,128,75,0.16);
  border-radius: 18px;
  display: grid;
  gap: 12px;
  padding: 14px;
}

.agent-office-whatsapp-phone > div {
  background: #075e54;
  border-radius: 14px;
  color: #fff;
  padding: 10px 12px;
}

.agent-office-whatsapp-phone span {
  display: block;
  font-size: 0.78rem;
  font-weight: 900;
}

.agent-office-whatsapp-phone small {
  color: rgba(255,255,255,0.78);
  display: block;
  font-size: 0.68rem;
  margin-top: 3px;
}

.agent-office-whatsapp-phone pre {
  background: #dcf8c6;
  border-radius: 12px 12px 3px 12px;
  color: #12372a;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  line-height: 1.48;
  margin: 0;
  overflow-wrap: anywhere;
  padding: 12px;
  white-space: pre-wrap;
}

.agent-office-whatsapp-phone button {
  background: #128c7e;
  border: 0;
  border-radius: 999px;
  color: #fff;
  cursor: default;
  font-size: 0.72rem;
  font-weight: 900;
  justify-self: start;
  padding: 9px 13px;
  text-transform: uppercase;
}

.agent-office-email-list {
  max-height: none;
  overflow: visible;
}

.agent-office-email-list {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.agent-office-email-template {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(18,18,18,0.08);
  border-left: 4px solid rgba(148,163,184,0.62);
  border-radius: 12px;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 11px;
}

.agent-office-email-template.status-active {
  border-left-color: #16a34a;
}

.agent-office-email-template.status-paused {
  border-left-color: #f59e0b;
}

.agent-office-email-template span {
  color: var(--gold-dark);
  display: block;
  font-size: 0.64rem;
  font-weight: 950;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.agent-office-email-template h4 {
  color: var(--text-primary);
  font-size: 0.9rem;
  margin: 4px 0 0;
}

.agent-office-email-template p {
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.35;
  margin: 4px 0 0;
}

.agent-office-email-template small {
  color: var(--text-muted);
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  margin-top: 6px;
}

.agent-office-email-template > div:last-child {
  align-items: center;
  display: flex;
  gap: 6px;
}

.agent-office-editorial-distribution {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 14px;
  display: grid;
  gap: 0;
  overflow: hidden;
}

.agent-office-editorial-distribution .agent-office-prompt-head {
  padding: 12px 14px;
}

.agent-office-editorial-actions {
  align-items: center;
  background: rgba(249,246,239,0.58);
  border-top: 1px solid rgba(201,169,110,0.14);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 14px;
}

.agent-office-editorial-list {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
}

.agent-office-editorial-campaign {
  align-items: center;
  background: rgba(249,246,239,0.58);
  border: 1px solid rgba(18,18,18,0.08);
  border-left: 4px solid rgba(148,163,184,0.62);
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 12px;
}

.agent-office-editorial-campaign.status-sending {
  border-left-color: #0ea5e9;
}

.agent-office-editorial-campaign.status-awaiting_approval {
  border-left-color: #d6a85b;
}

.agent-office-editorial-campaign.status-completed {
  border-left-color: #16a34a;
}

.agent-office-editorial-campaign.status-finished_with_errors {
  border-left-color: #f59e0b;
}

.agent-office-editorial-campaign span {
  color: var(--gold-dark);
  display: block;
  font-size: 0.64rem;
  font-weight: 950;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.agent-office-editorial-campaign h4 {
  color: var(--text-primary);
  font-size: 0.94rem;
  line-height: 1.25;
  margin: 5px 0 0;
}

.agent-office-editorial-campaign p,
.agent-office-editorial-campaign small {
  color: var(--text-muted);
  display: block;
  font-size: 0.72rem;
  line-height: 1.4;
  margin: 6px 0 0;
}

.agent-office-editorial-campaign > div:last-child {
  align-items: center;
  display: flex;
  gap: 7px;
  justify-content: flex-end;
}

.agent-office-prompt-meta {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.agent-office-prompt-meta span {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.22);
  border-radius: 999px;
  color: var(--gold-dark);
  font-size: 0.7rem;
  font-weight: 900;
  padding: 6px 9px;
}

.agent-office-prompt-editor {
  background: #000;
  border: 1px solid #1f1f1f;
  box-shadow: 0 18px 44px rgba(0,0,0,0.14);
  border-radius: 14px;
  margin: 12px;
  min-height: 360px;
  overflow: hidden;
  position: relative;
}

.agent-office-prompt-editor::before {
  content: none;
}

.agent-office-prompt-editor::after {
  content: none;
}

.agent-office-prompt-editor textarea {
  background: transparent;
  border: 0;
  color: #fff;
  caret-color: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.83rem;
  line-height: 1.55;
  min-height: 360px;
  outline: none;
  padding: 18px;
  position: relative;
  resize: vertical;
  width: 100%;
  z-index: 2;
}

.agent-office-prompt-editor textarea::placeholder {
  color: rgba(255,255,255,0.55);
}

.agent-office-prompt-editor textarea::selection {
  background: rgba(255,255,255,0.24);
  color: #fff;
}

.agent-office-prompt-editor textarea::-webkit-scrollbar {
  height: 12px;
  width: 12px;
}

.agent-office-prompt-editor textarea::-webkit-scrollbar-track {
  background: #000;
}

.agent-office-prompt-editor textarea::-webkit-scrollbar-thumb {
  background: #4b5563;
  border: 3px solid #000;
  border-radius: 999px;
}

.agent-office-tag-panel {
  background: linear-gradient(180deg, rgba(99,102,241,0.045), rgba(255,255,255,0.94));
  border-bottom: 1px solid rgba(201,169,110,0.16);
  display: grid;
  gap: 8px;
  padding: 10px 14px;
}

.agent-office-tag-panel strong {
  color: #6366f1;
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.agent-office-tag-panel div {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.agent-office-tag-panel button {
  align-items: center;
  border: 1px solid;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.68rem;
  font-weight: 800;
  height: 28px;
  justify-content: center;
  line-height: 1;
  min-height: 28px;
  padding: 4px 8px;
}

.agent-office-tag-panel small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.4;
}

.agent-office-actions {
  align-items: center;
  background: #fff;
  border-top: 1px solid rgba(201,169,110,0.18);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 14px;
}

.agent-office-actions.compact {
  background: transparent;
  border-top: 0;
  flex: 0 0 auto;
  justify-content: flex-end;
  padding: 0;
}

.agent-office-save,
.agent-office-legacy-link {
  align-items: center;
  border-radius: 10px;
  display: inline-flex;
  font-size: 0.82rem;
  font-weight: 900;
  gap: 8px;
  min-height: 38px;
  padding: 9px 13px;
  text-decoration: none;
}

.agent-office-save {
  background: var(--gold);
  border: 1px solid var(--gold);
  color: #111;
  cursor: pointer;
}

.agent-office-save:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.agent-office-legacy-link {
  background: transparent;
  border: 1px solid rgba(18,18,18,0.12);
  color: var(--text-secondary);
}

.agent-office-save-message {
  font-size: 0.78rem;
  font-weight: 800;
}

.agent-office-save-message.success {
  color: #16a34a;
}

.agent-office-save-message.error {
  color: #dc2626;
}

.agent-office-save-message.saving {
  color: var(--gold-dark);
}

.agent-office-roadmap {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.agent-office-roadmap div {
  align-items: flex-start;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  display: grid;
  gap: 6px;
  grid-template-columns: 26px minmax(0, 1fr);
  padding: 14px;
}

.agent-office-roadmap svg {
  color: var(--gold-dark);
  grid-row: span 2;
}

.agent-office-roadmap strong {
  color: var(--text-primary);
}

.agent-office-roadmap span {
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}


`

export default function AgentOfficeStyles() {
  return (
    <style
      id="agent-office-styles"
      dangerouslySetInnerHTML={{ __html: AGENT_OFFICE_CSS }}
    />
  )
}
