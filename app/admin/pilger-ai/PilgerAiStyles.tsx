const PILGER_AI_CSS = `
.pilger-ai-page {
  display: grid;
  gap: 22px;
}
.pilger-ai-hero {
  align-items: flex-start;
  background: linear-gradient(135deg, rgba(18,18,18,0.96), rgba(47,40,30,0.94));
  border: 1px solid rgba(201,169,110,0.28);
  border-radius: 18px;
  color: #fff;
  display: flex;
  gap: 20px;
  justify-content: space-between;
  padding: 28px;
}
.pilger-ai-eyebrow {
  color: var(--gold-light);
  display: block;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  margin-bottom: 10px;
  text-transform: uppercase;
}
.pilger-ai-hero h1 {
  color: #fff;
  font-family: 'Playfair Display', serif;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1;
  margin: 0 0 12px;
}
.pilger-ai-hero p {
  color: rgba(255,255,255,0.72);
  line-height: 1.55;
  margin: 0;
  max-width: 760px;
}
.pilger-ai-status {
  align-items: center;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 999px;
  color: #f7e6c4;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 800;
  gap: 8px;
  padding: 10px 14px;
}

.pilger-ai-hero-detail {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 14px;
}

.pilger-ai-hero-detail > span {
  color: var(--gold-light);
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pilger-ai-hero-detail > strong {
  align-items: center;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  color: #fff;
  display: inline-flex;
  font-size: 0.78rem;
  gap: 7px;
  padding: 7px 10px;
}

.pilger-ai-hero-detail svg {
  color: var(--gold-light);
}

.pilger-ai-hero-side {
  align-items: flex-end;
  display: grid;
  flex: 0 0 auto;
  gap: 12px;
  justify-items: end;
}

.pilger-ai-hero-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.pilger-ai-hero-actions .agent-org-live-badge {
  background: rgba(37,99,235,0.16);
  border-color: rgba(191,219,254,0.28);
  color: #dbeafe;
}

.pilger-ai-hero-actions .agent-org-refresh {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.16);
  color: rgba(255,255,255,0.82);
}

.pilger-ai-hero-actions .agent-org-refresh strong {
  color: #fff;
}

.pilger-ai-hero-actions .agent-org-refresh svg {
  color: var(--gold-light);
}

.pilger-ai-hero-with-compact-metrics {
  align-items: stretch;
}

.pilger-ai-hero-with-compact-metrics > div:first-child {
  align-self: center;
}

.pilger-ai-hero-metrics {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(92px, 1fr));
  min-width: min(440px, 42vw);
}

.pilger-ai-hero-metric {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 12px;
  display: grid;
  gap: 2px;
  padding: 9px 10px;
}

.pilger-ai-hero-metric strong {
  color: #fff;
  font-family: 'Playfair Display', serif;
  font-size: 1.25rem;
  line-height: 1;
}

.pilger-ai-hero-metric span {
  color: rgba(255,255,255,0.66);
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.pilger-ai-metrics {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.pilger-ai-metric,
.pilger-ai-card,
.pilger-ai-note,
.pilger-ai-timeline {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.pilger-ai-metric {
  display: grid;
  gap: 6px;
  padding: 18px;
}
.pilger-ai-metric span {
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pilger-ai-metric strong {
  color: var(--text-primary);
  font-family: 'Playfair Display', serif;
  font-size: 1.8rem;
}
.pilger-ai-metric small,
.pilger-ai-card p {
  color: var(--text-muted);
  line-height: 1.45;
}
.pilger-ai-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.pilger-ai-card {
  padding: 18px;
}
.pilger-ai-card-icon {
  align-items: center;
  background: rgba(201,169,110,0.12);
  border-radius: 10px;
  color: var(--gold-dark);
  display: flex;
  height: 38px;
  justify-content: center;
  margin-bottom: 14px;
  width: 38px;
}
.pilger-ai-card h2 {
  color: var(--text-primary);
  font-size: 1rem;
  margin: 0 0 8px;
}
.pilger-ai-card p {
  font-size: 0.85rem;
  margin: 0;
}
.pilger-ai-note {
  align-items: center;
  color: var(--text-secondary);
  display: flex;
  gap: 10px;
  padding: 14px 16px;
}
.pilger-ai-timeline {
  display: grid;
  gap: 10px;
  padding: 16px;
}
.pilger-ai-timeline div {
  align-items: center;
  display: flex;
  gap: 12px;
}
.pilger-ai-timeline span {
  align-items: center;
  background: rgba(201,169,110,0.14);
  border-radius: 999px;
  color: var(--gold-dark);
  display: flex;
  font-weight: 900;
  height: 30px;
  justify-content: center;
  width: 30px;
}

.pilger-ai-live-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.pilger-ai-live-metric {
  background:
    linear-gradient(135deg, rgba(201,169,110,0.08), rgba(255,255,255,0.92));
  border: 1px solid rgba(201,169,110,0.2);
  border-radius: 14px;
  padding: 16px;
}

.pilger-ai-live-metric span,
.pilger-ai-ops-head span {
  color: var(--gold-dark);
  display: block;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.13em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.pilger-ai-live-metric strong {
  color: var(--text-primary);
  display: block;
  font-family: 'Playfair Display', serif;
  font-size: 1.9rem;
  line-height: 1.05;
}

.pilger-ai-live-metric small {
  color: var(--text-muted);
  display: block;
  line-height: 1.35;
  margin-top: 8px;
}

.pilger-ai-ops-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.82fr);
}

.pilger-ai-ops-panel,
.pilger-ai-governance-strip {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.05);
}

.pilger-ai-ops-panel {
  padding: 18px;
}

.pilger-ai-ops-head {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 16px;
}

.pilger-ai-ops-head h2 {
  align-items: center;
  color: var(--text-primary);
  display: flex;
  font-size: 1.08rem;
  gap: 8px;
  margin: 0;
}

.pilger-ai-ops-head p {
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.45;
  margin: 8px 0 0;
  max-width: 720px;
}

.pilger-ai-ops-head > strong {
  align-items: center;
  background: rgba(201,169,110,0.12);
  border: 1px solid rgba(201,169,110,0.22);
  border-radius: 999px;
  color: var(--gold-dark);
  display: flex;
  flex: 0 0 auto;
  font-family: 'Playfair Display', serif;
  font-size: 1.35rem;
  height: 42px;
  justify-content: center;
  min-width: 42px;
  padding: 0 12px;
}

.pilger-ai-work-list,
.pilger-ai-event-list {
  display: grid;
  gap: 10px;
}

.pilger-ai-work-row,
.pilger-ai-event-row {
  background: linear-gradient(90deg, rgba(249,246,239,0.72), rgba(255,255,255,0.96));
  border: 1px solid rgba(201,169,110,0.15);
  border-radius: 13px;
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 12px;
}

.pilger-ai-work-row {
  align-items: center;
  grid-template-columns: 12px minmax(0, 1fr) auto;
}

.pilger-ai-event-row {
  grid-template-columns: 38px minmax(0, 1fr);
}

.pilger-ai-work-dot {
  border-radius: 999px;
  height: 10px;
  width: 10px;
}

.pilger-ai-work-main,
.pilger-ai-event-row > div:last-child {
  min-width: 0;
}

.pilger-ai-work-title,
.pilger-ai-event-title {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  min-width: 0;
}

.pilger-ai-work-title strong,
.pilger-ai-event-title strong,
.pilger-ai-agent-card strong {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pilger-ai-work-row p,
.pilger-ai-event-row p,
.pilger-ai-agent-card p {
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
  margin: 5px 0 0;
}

.pilger-ai-work-meta {
  color: var(--text-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: 0.72rem;
  gap: 8px;
  margin-top: 8px;
}

.pilger-ai-work-meta span {
  background: rgba(18,18,18,0.04);
  border: 1px solid rgba(18,18,18,0.05);
  border-radius: 999px;
  padding: 4px 8px;
}

.pilger-ai-status-pill {
  border-radius: 999px;
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-weight: 900;
  padding: 5px 8px;
  text-transform: uppercase;
}

.pilger-ai-row-link {
  align-items: center;
  border: 1px solid rgba(201,169,110,0.32);
  border-radius: 999px;
  color: var(--gold-dark);
  display: flex;
  height: 34px;
  justify-content: center;
  text-decoration: none;
  width: 34px;
}

.pilger-ai-event-icon {
  align-items: center;
  border-radius: 12px;
  display: flex;
  height: 38px;
  justify-content: center;
  width: 38px;
}

.pilger-ai-event-title span {
  color: var(--text-muted);
  flex: 0 0 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.68rem;
}

.pilger-ai-agent-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}

.pilger-ai-agent-card {
  background: linear-gradient(135deg, rgba(249,246,239,0.8), rgba(255,255,255,0.96));
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 14px;
  padding: 14px;
}

.pilger-ai-agent-card > span,
.pilger-ai-agent-card small {
  display: block;
}

.pilger-ai-agent-card > span {
  color: var(--gold-dark);
  font-size: 0.72rem;
  font-weight: 900;
  margin-top: 4px;
  text-transform: uppercase;
}

.pilger-ai-agent-card small {
  font-weight: 900;
  margin-top: 10px;
}

.pilger-ai-empty {
  align-items: center;
  background: rgba(249,246,239,0.64);
  border: 1px dashed rgba(201,169,110,0.3);
  border-radius: 13px;
  color: var(--text-muted);
  display: flex;
  font-size: 0.86rem;
  justify-content: center;
  min-height: 92px;
  padding: 18px;
  text-align: center;
}

.pilger-ai-governance-strip {
  align-items: center;
  color: var(--text-secondary);
  display: flex;
  gap: 12px;
  padding: 14px 16px;
}

.pilger-ai-governance-strip svg {
  color: var(--gold-dark);
  flex: 0 0 auto;
}

.pilger-ai-governance-strip strong,
.pilger-ai-governance-strip span {
  display: block;
}

.pilger-ai-governance-strip strong {
  color: var(--text-primary);
}

.pilger-ai-governance-strip span {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.35;
  margin-top: 2px;
}

.agent-org-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.42fr) minmax(300px, 0.58fr);
}

.agent-org-grid-full {
  grid-template-columns: minmax(0, 1fr);
}

.agent-org-panel,
.agent-org-status-panel {
  background: #0f1014;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  box-shadow: 0 22px 60px rgba(15,23,42,0.12);
  color: #f8fafc;
}

.agent-org-panel {
  overflow: visible;
}

.agent-org-head {
  align-items: flex-start;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 18px 20px;
}

.agent-org-head span,
.agent-org-side-title span {
  color: #e8c987;
  display: block;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.agent-org-head h2,
.agent-org-side-title strong {
  align-items: center;
  color: #fff;
  display: flex;
  font-size: 1.02rem;
  gap: 8px;
  margin: 0;
}

.agent-org-head p {
  color: rgba(248,250,252,0.68);
  font-size: 0.86rem;
  line-height: 1.42;
  margin: 8px 0 0;
  max-width: 680px;
}

.agent-org-live-badge {
  align-items: center;
  background: rgba(73,189,255,0.1);
  border: 1px solid rgba(73,189,255,0.24);
  border-radius: 999px;
  color: #dff6ff;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 850;
  gap: 8px;
  padding: 9px 12px;
}

.agent-org-head-actions {
  align-items: flex-end;
  display: grid;
  flex: 0 0 auto;
  gap: 8px;
  justify-items: end;
}

.agent-org-refresh {
  align-items: center;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  color: rgba(248,250,252,0.82);
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 850;
  gap: 7px;
  padding: 8px 10px;
}

.agent-org-refresh svg {
  color: #e8c987;
}

.agent-org-refresh strong {
  color: #fff;
}

.agent-org-tooltip {
  background: rgba(8,10,14,0.98);
  border: 1px solid rgba(232,201,135,0.34);
  border-radius: 12px;
  bottom: calc(100% + 10px);
  box-shadow: 0 18px 42px rgba(0,0,0,0.42);
  color: #fff;
  display: grid;
  gap: 7px;
  left: 50%;
  opacity: 0;
  padding: 12px;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 8px);
  transition: opacity 0.16s ease, transform 0.16s ease;
  width: 280px;
  z-index: 30;
}

.agent-flow-node:hover .agent-org-tooltip,
.agent-flow-node:focus .agent-org-tooltip,
.agent-flow-node:focus-within .agent-org-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.agent-org-tooltip small {
  color: #e8c987;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.agent-org-tooltip p {
  color: rgba(248,250,252,0.78);
  display: block;
  font-size: 0.76rem;
  line-height: 1.35;
  margin: 0;
  min-height: 0;
}

.agent-org-tooltip div {
  display: grid;
  gap: 5px;
}

.agent-org-tooltip div span {
  color: rgba(248,250,252,0.68);
  font-size: 0.7rem;
  line-height: 1.3;
}

.agent-org-side {
  display: grid;
  gap: 18px;
}

.agent-org-status-panel {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.agent-org-side-title {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 34px minmax(0, 1fr);
}

.agent-org-side-title > svg {
  background: rgba(232,201,135,0.12);
  border: 1px solid rgba(232,201,135,0.26);
  border-radius: 11px;
  color: #f4d58a;
  height: 34px;
  padding: 8px;
  width: 34px;
}

.agent-org-activity-list,
.agent-org-flow-steps {
  display: grid;
  gap: 10px;
}

.agent-org-activity {
  align-items: flex-start;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  display: grid;
  gap: 10px;
  grid-template-columns: 11px minmax(0, 1fr);
  padding: 10px;
}

.agent-org-activity-dot {
  border-radius: 999px;
  height: 9px;
  margin-top: 4px;
  width: 9px;
}

.agent-org-activity p,
.agent-org-side-empty,
.agent-org-flow-steps p {
  color: rgba(248,250,252,0.66);
  font-size: 0.78rem;
  line-height: 1.35;
  margin: 4px 0 0;
}

.agent-org-activity small {
  color: rgba(248,250,252,0.44);
  display: block;
  font-size: 0.68rem;
  margin-top: 7px;
}

.agent-org-flow-steps div {
  align-items: flex-start;
  display: grid;
  gap: 10px;
  grid-template-columns: 28px minmax(0, 1fr);
}

.agent-org-flow-steps span {
  align-items: center;
  background: rgba(73,189,255,0.12);
  border: 1px solid rgba(73,189,255,0.24);
  border-radius: 999px;
  color: #bfefff;
  display: flex;
  font-size: 0.72rem;
  font-weight: 900;
  height: 28px;
  justify-content: center;
  width: 28px;
}

@media (max-width: 1180px) {
  .agent-org-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .pilger-ai-hero,
  .agent-org-head {
    display: grid;
  }

  .pilger-ai-hero-side {
    align-items: stretch;
    justify-items: stretch;
  }

  .pilger-ai-hero-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: 0;
  }

  .pilger-ai-metrics,
  .pilger-ai-live-metrics {
    grid-template-columns: 1fr;
  }
}

.agent-org-panel,
.agent-org-status-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.agent-org-head {
  background: linear-gradient(90deg, rgba(249,246,239,0.84), rgba(255,255,255,0.98));
  border-bottom: 1px solid var(--border);
}

.agent-org-head span,
.agent-org-side-title span {
  color: var(--gold-dark);
}

.agent-org-head h2,
.agent-org-side-title strong,
.agent-org-activity strong {
  color: var(--text-primary);
}

.agent-org-head p,
.agent-org-activity p,
.agent-org-side-empty,
.agent-org-flow-steps p {
  color: var(--text-muted);
}

.agent-org-live-badge {
  background: rgba(59,130,246,0.08);
  border: 1px solid rgba(59,130,246,0.18);
  color: #2563eb;
}

.agent-org-refresh {
  background: rgba(201,169,110,0.08);
  border: 1px solid rgba(201,169,110,0.22);
  color: var(--text-secondary);
}

.agent-org-refresh svg,
.agent-org-side-title > svg {
  color: var(--gold-dark);
}

.agent-org-refresh strong {
  color: var(--text-primary);
}

.agent-flow-board {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.agent-flow-board-head {
  align-items: center;
  background: rgba(249,246,239,0.74);
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 12px;
  color: var(--text-muted);
  display: grid;
  font-size: 0.72rem;
  font-weight: 900;
  gap: 12px;
  grid-template-columns: minmax(0,1fr) minmax(280px,0.86fr) minmax(0,1fr);
  letter-spacing: 0.1em;
  padding: 10px 14px;
  text-transform: uppercase;
}

.agent-flow-board-head span {
  align-items: center;
  display: flex;
  gap: 7px;
}

.agent-flow-board-head span:nth-child(2) {
  justify-content: center;
}

.agent-flow-board-head span:nth-child(3) {
  justify-content: flex-end;
}

.agent-flow-layer {
  display: grid;
  gap: 10px;
}

.agent-flow-layer-title {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 0 2px;
}

.agent-flow-layer-title strong {
  color: var(--text-primary);
  font-size: 0.95rem;
}

.agent-flow-layer-title span {
  background: rgba(201,169,110,0.1);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 999px;
  color: var(--gold-dark);
  font-size: 0.72rem;
  font-weight: 850;
  padding: 5px 9px;
}

.agent-flow-rows {
  display: grid;
  gap: 10px;
}

.agent-flow-row {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 14px;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0,1fr) 54px minmax(280px,0.9fr) 54px minmax(0,1fr);
  padding: 10px;
}

.agent-flow-data {
  background: rgba(249,246,239,0.74);
  border: 1px solid rgba(201,169,110,0.12);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  min-height: 92px;
  min-width: 0;
  padding: 10px;
}

.agent-flow-data > span {
  align-items: center;
  color: var(--gold-dark);
  display: flex;
  font-size: 0.68rem;
  font-weight: 900;
  gap: 6px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.agent-flow-data > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-flow-data small,
.agent-org-memory-tags span {
  background: #fff;
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 750;
  line-height: 1.2;
  padding: 5px 8px;
}

.agent-flow-rail {
  height: 28px;
  position: relative;
}

.agent-flow-rail::before {
  background: linear-gradient(90deg, rgba(201,169,110,0.12), rgba(59,130,246,0.35), rgba(201,169,110,0.12));
  border-radius: 999px;
  content: "";
  height: 2px;
  left: 0;
  position: absolute;
  right: 0;
  top: 50%;
}

.agent-flow-rail span {
  animation: agentFlowPulse 2.8s linear infinite;
  background: #2563eb;
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: 0 0 0 5px rgba(59,130,246,0.12);
  height: 11px;
  left: 0;
  position: absolute;
  top: calc(50% - 5px);
  width: 11px;
}

.agent-flow-rail-out span {
  animation-delay: 1.2s;
  background: var(--gold-dark);
  box-shadow: 0 0 0 5px rgba(201,169,110,0.14);
}

@keyframes agentFlowPulse {
  from { left: 0; opacity: 0.25; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  to { left: calc(100% - 11px); opacity: 0.25; }
}

.agent-flow-node {
  align-items: center;
  background: linear-gradient(135deg, #ffffff, rgba(249,246,239,0.82));
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 13px;
  box-shadow: 0 14px 34px rgba(15,23,42,0.07);
  display: grid;
  gap: 10px;
  grid-template-columns: 46px minmax(0,1fr) auto;
  min-width: 0;
  padding: 10px;
  position: relative;
}

.agent-flow-avatar {
  align-items: center;
  background: rgba(201,169,110,0.12);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 12px;
  color: var(--gold-dark);
  display: flex;
  font-weight: 900;
  height: 46px;
  justify-content: center;
  overflow: hidden;
  width: 46px;
}

.agent-flow-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.agent-flow-node-main {
  min-width: 0;
}

.agent-flow-node-main strong,
.agent-flow-node-main small,
.agent-flow-node-main p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-flow-node-main strong {
  color: var(--text-primary);
  font-size: 0.94rem;
}

.agent-flow-node-main small {
  color: var(--gold-dark);
  font-size: 0.68rem;
  font-weight: 900;
  margin-top: 2px;
  text-transform: uppercase;
}

.agent-flow-node-main p {
  color: var(--text-muted);
  font-size: 0.75rem;
  margin: 5px 0 0;
}

.agent-flow-status {
  align-items: center;
  color: var(--text-muted);
  display: flex;
  font-size: 0.7rem;
  font-weight: 850;
  gap: 6px;
  white-space: nowrap;
}

.agent-flow-status span {
  background: currentColor;
  border-radius: 999px;
  height: 8px;
  width: 8px;
}

.agent-flow-node.pilger-ai-tone-success,
.agent-flow-node.pilger-ai-tone-warning,
.agent-flow-node.pilger-ai-tone-danger,
.agent-flow-node.pilger-ai-tone-info,
.agent-flow-node.pilger-ai-tone-muted {
  background: linear-gradient(135deg, #ffffff, rgba(249,246,239,0.82));
  color: var(--text-primary);
}

.agent-flow-node.pilger-ai-tone-success { border-color: rgba(34,197,94,0.22); }
.agent-flow-node.pilger-ai-tone-warning { border-color: rgba(245,158,11,0.24); }
.agent-flow-node.pilger-ai-tone-danger { border-color: rgba(239,68,68,0.22); }
.agent-flow-node.pilger-ai-tone-info { border-color: rgba(59,130,246,0.22); }
.agent-flow-node.pilger-ai-tone-muted { border-color: rgba(100,116,139,0.18); }

.agent-flow-node.pilger-ai-tone-success .agent-flow-status { color: #16a34a; }
.agent-flow-node.pilger-ai-tone-warning .agent-flow-status { color: #b7791f; }
.agent-flow-node.pilger-ai-tone-danger .agent-flow-status { color: #dc2626; }
.agent-flow-node.pilger-ai-tone-info .agent-flow-status { color: #2563eb; }

.agent-org-tooltip {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.26);
  box-shadow: 0 18px 42px rgba(15,23,42,0.16);
  color: var(--text-primary);
}

.agent-org-tooltip small {
  color: var(--gold-dark);
}

.agent-org-tooltip p,
.agent-org-tooltip div span {
  color: var(--text-muted);
}

.agent-org-side-title > svg {
  background: rgba(201,169,110,0.1);
  border: 1px solid rgba(201,169,110,0.22);
}

.agent-org-memory-panel > p {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.45;
  margin: 0;
}

.agent-org-memory-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.agent-org-activity {
  background: rgba(249,246,239,0.66);
  border: 1px solid rgba(201,169,110,0.13);
}

.agent-org-activity small {
  color: var(--text-muted);
}

.agent-org-flow-steps span {
  background: rgba(201,169,110,0.1);
  border: 1px solid rgba(201,169,110,0.22);
  color: var(--gold-dark);
}

@media (max-width: 1080px) {
  .agent-flow-board-head {
    display: none;
  }

  .agent-flow-row {
    grid-template-columns: 1fr;
  }

  .agent-flow-rail {
    height: 18px;
  }
}

.agent-ecosystem-panel {
  overflow: visible;
}

.agent-ecosystem-board {
  background:
    linear-gradient(180deg, rgba(249,246,239,0.72), rgba(255,255,255,0.96)),
    radial-gradient(circle at 50% 0%, rgba(201,169,110,0.14), transparent 36%);
  border-radius: 0 0 16px 16px;
  overflow: visible;
  padding: 18px;
  position: relative;
}

.agent-central-hub {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 16px;
  box-shadow: 0 18px 45px rgba(15,23,42,0.08);
  display: grid;
  gap: 14px;
  grid-template-columns: 58px minmax(0,1fr);
  margin: 0 auto;
  max-width: 660px;
  padding: 16px;
  position: relative;
  z-index: 3;
}

.agent-central-icon {
  align-items: center;
  background: rgba(201,169,110,0.12);
  border: 1px solid rgba(201,169,110,0.24);
  border-radius: 15px;
  color: var(--gold-dark);
  display: flex;
  height: 58px;
  justify-content: center;
  width: 58px;
}

.agent-central-hub span,
.agent-sector-head span,
.agent-sector-flow-box > span {
  color: var(--gold-dark);
  display: block;
  font-size: 0.67rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.agent-central-hub strong {
  color: var(--text-primary);
  display: block;
  font-size: 1.08rem;
}

.agent-central-hub p,
.agent-sector-head p {
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.38;
  margin: 4px 0 0;
}

.agent-central-stats,
.agent-central-photo-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  grid-column: 1 / -1;
}

.agent-central-stats span {
  background: rgba(249,246,239,0.82);
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 0.72rem;
  letter-spacing: 0;
  padding: 6px 9px;
  text-transform: none;
}

.agent-central-stats strong {
  display: inline;
  font-size: 0.78rem;
}

.agent-central-photo-strip {
  align-items: center;
  margin-top: -2px;
}

.agent-data-bus {
  height: 72px;
  margin: 0 18px 8px;
  position: relative;
  z-index: 1;
}

.agent-data-bus::before {
  background: linear-gradient(180deg, rgba(201,169,110,0.34), rgba(59,130,246,0.22));
  content: "";
  height: 44px;
  left: 50%;
  position: absolute;
  top: 0;
  width: 2px;
}

.agent-data-bus::after {
  background: linear-gradient(90deg, rgba(201,169,110,0.08), rgba(59,130,246,0.28), rgba(201,169,110,0.08));
  border-radius: 999px;
  bottom: 12px;
  content: "";
  height: 2px;
  left: 0;
  position: absolute;
  right: 0;
}

.agent-data-pulse {
  border: 2px solid #fff;
  border-radius: 999px;
  bottom: 7px;
  height: 12px;
  position: absolute;
  width: 12px;
}

.agent-data-pulse-out {
  animation: agentBusOut 4.2s linear infinite;
  background: #2563eb;
  box-shadow: 0 0 0 6px rgba(59,130,246,0.12);
}

.agent-data-pulse-in {
  animation: agentBusIn 4.2s linear infinite;
  background: var(--gold-dark);
  box-shadow: 0 0 0 6px rgba(201,169,110,0.14);
}

@keyframes agentBusOut {
  from { left: 50%; opacity: 0.18; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  to { left: calc(100% - 12px); opacity: 0.18; }
}

@keyframes agentBusIn {
  from { left: 0; opacity: 0.18; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  to { left: 50%; opacity: 0.18; }
}

.agent-sector-grid {
  align-items: start;
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  overflow: visible;
  position: relative;
  z-index: 2;
}

.agent-sector-card {
  background: #fff;
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 15px;
  box-shadow: 0 14px 34px rgba(15,23,42,0.06);
  color: var(--text-primary);
  overflow: visible;
  padding: 14px;
  position: relative;
}

.agent-sector-card.pilger-ai-tone-success,
.agent-sector-card.pilger-ai-tone-warning,
.agent-sector-card.pilger-ai-tone-danger,
.agent-sector-card.pilger-ai-tone-info,
.agent-sector-card.pilger-ai-tone-muted {
  background: #fff;
  color: var(--text-primary);
}

.agent-sector-card.pilger-ai-tone-success { border-color: rgba(34,197,94,0.24); }
.agent-sector-card.pilger-ai-tone-warning { border-color: rgba(245,158,11,0.26); }
.agent-sector-card.pilger-ai-tone-danger { border-color: rgba(239,68,68,0.24); }
.agent-sector-card.pilger-ai-tone-info { border-color: rgba(59,130,246,0.22); }

.agent-sector-link {
  background: linear-gradient(180deg, rgba(59,130,246,0.28), rgba(201,169,110,0.24));
  height: 28px;
  left: 50%;
  overflow: hidden;
  position: absolute;
  top: -28px;
  transform: translateX(-50%);
  width: 2px;
}

.agent-sector-pulse {
  border-radius: 999px;
  height: 8px;
  left: -3px;
  position: absolute;
  width: 8px;
}

.agent-sector-pulse-out {
  animation: agentSectorOut 2.8s linear infinite;
  animation-delay: var(--sector-delay);
  background: #2563eb;
}

.agent-sector-pulse-in {
  animation: agentSectorIn 2.8s linear infinite;
  animation-delay: calc(var(--sector-delay) + 1.2s);
  background: var(--gold-dark);
}

@keyframes agentSectorOut {
  from { top: 0; opacity: 0.15; }
  30% { opacity: 1; }
  to { top: 28px; opacity: 0.2; }
}

@keyframes agentSectorIn {
  from { top: 28px; opacity: 0.15; }
  30% { opacity: 1; }
  to { top: 0; opacity: 0.2; }
}

.agent-sector-head {
  align-items: start;
  display: grid;
  gap: 10px;
  grid-template-columns: 38px minmax(0,1fr) auto;
}

.agent-sector-icon,
.agent-sector-count {
  align-items: center;
  border-radius: 12px;
  display: flex;
  justify-content: center;
}

.agent-sector-icon {
  background: rgba(201,169,110,0.1);
  border: 1px solid rgba(201,169,110,0.2);
  color: var(--gold-dark);
  height: 38px;
  width: 38px;
}

.agent-sector-count {
  background: rgba(15,23,42,0.04);
  border: 1px solid rgba(15,23,42,0.08);
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 900;
  gap: 5px;
  padding: 7px 9px;
}

.agent-sector-head strong {
  color: var(--text-primary);
  display: block;
  font-size: 1rem;
}

.agent-sector-agents {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(178px, 1fr));
  margin-top: 14px;
  overflow: visible;
  padding-top: 14px;
  position: relative;
}

.agent-sector-agents::before {
  background: linear-gradient(90deg, rgba(201,169,110,0.08), rgba(59,130,246,0.22), rgba(201,169,110,0.08));
  border-radius: 999px;
  content: "";
  height: 2px;
  left: 16px;
  position: absolute;
  right: 16px;
  top: 0;
}

.agent-photo-card {
  align-items: center;
  background: linear-gradient(135deg, #fff, rgba(249,246,239,0.74));
  border: 1px solid rgba(201,169,110,0.16);
  border-radius: 13px;
  color: var(--text-primary);
  display: grid;
  gap: 8px 10px;
  grid-template-columns: 52px minmax(0,1fr);
  min-width: 0;
  overflow: visible;
  padding: 10px;
  position: relative;
  z-index: 1;
}

.agent-photo-card::before {
  background: rgba(59,130,246,0.2);
  content: "";
  height: 14px;
  left: 36px;
  position: absolute;
  top: -14px;
  width: 2px;
}

.agent-photo-card.pilger-ai-tone-success,
.agent-photo-card.pilger-ai-tone-warning,
.agent-photo-card.pilger-ai-tone-danger,
.agent-photo-card.pilger-ai-tone-info,
.agent-photo-card.pilger-ai-tone-muted {
  background: linear-gradient(135deg, #fff, rgba(249,246,239,0.74));
  color: var(--text-primary);
}

.agent-photo-card.pilger-ai-tone-success { border-color: rgba(34,197,94,0.24); }
.agent-photo-card.pilger-ai-tone-warning { border-color: rgba(245,158,11,0.26); }
.agent-photo-card.pilger-ai-tone-danger { border-color: rgba(239,68,68,0.24); }
.agent-photo-card.pilger-ai-tone-info { border-color: rgba(59,130,246,0.22); }

.agent-photo-avatar {
  align-items: center;
  background: rgba(201,169,110,0.12);
  border: 1px solid rgba(201,169,110,0.18);
  border-radius: 14px;
  color: var(--gold-dark);
  display: flex;
  font-size: 0.78rem;
  font-weight: 900;
  height: 52px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 52px;
}

.agent-photo-avatar-compact {
  border-radius: 999px;
  height: 34px;
  margin-left: -8px;
  width: 34px;
}

.agent-photo-avatar-compact:first-child {
  margin-left: 0;
}

.agent-photo-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.agent-photo-status {
  border: 2px solid #fff;
  border-radius: 999px;
  bottom: -1px;
  height: 13px;
  position: absolute;
  right: -1px;
  width: 13px;
}

.agent-photo-status.pilger-ai-tone-success { background: #16a34a; }
.agent-photo-status.pilger-ai-tone-warning { background: #f59e0b; }
.agent-photo-status.pilger-ai-tone-danger { background: #dc2626; }
.agent-photo-status.pilger-ai-tone-info { background: #2563eb; }
.agent-photo-status.pilger-ai-tone-muted { background: #94a3b8; }

.agent-photo-copy {
  min-width: 0;
}

.agent-photo-copy strong,
.agent-photo-copy small,
.agent-photo-copy p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-photo-copy strong {
  color: var(--text-primary);
  font-size: 0.88rem;
}

.agent-photo-copy small {
  color: var(--gold-dark);
  font-size: 0.66rem;
  font-weight: 900;
  margin-top: 2px;
  text-transform: uppercase;
}

.agent-photo-copy p {
  color: var(--text-muted);
  font-size: 0.72rem;
  margin: 5px 0 0;
}

.agent-photo-flows {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  grid-column: 1 / -1;
}

.agent-photo-flows span,
.agent-sector-flow-box small,
.agent-org-memory-tags span {
  align-items: center;
  background: #fff;
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: 999px;
  color: var(--text-secondary);
  display: inline-flex;
  font-size: 0.66rem;
  font-weight: 750;
  gap: 4px;
  line-height: 1.2;
  padding: 5px 7px;
}

.agent-photo-card:hover .agent-org-tooltip,
.agent-photo-card:focus .agent-org-tooltip,
.agent-photo-card:focus-within .agent-org-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.agent-sector-flow-summary {
  border-top: 1px solid rgba(201,169,110,0.14);
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0,1fr));
  margin-top: 14px;
  padding-top: 12px;
}

.agent-sector-flow-box {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.agent-sector-flow-box > span {
  align-items: center;
  display: flex;
  gap: 6px;
}

.agent-sector-flow-box div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-flow-legend {
  display: grid;
  gap: 8px;
}

.agent-flow-legend span {
  align-items: center;
  color: var(--text-secondary);
  display: flex;
  font-size: 0.78rem;
  font-weight: 800;
  gap: 8px;
}

.agent-flow-legend i {
  border-radius: 999px;
  display: inline-flex;
  height: 10px;
  width: 10px;
}

.agent-flow-legend-blue {
  background: #2563eb;
  box-shadow: 0 0 0 5px rgba(59,130,246,0.1);
}

.agent-flow-legend-gold {
  background: var(--gold-dark);
  box-shadow: 0 0 0 5px rgba(201,169,110,0.12);
}

@media (max-width: 1180px) {
  .agent-sector-grid {
    grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  }
}

@media (max-width: 720px) {
  .agent-ecosystem-board {
    padding: 14px;
  }

  .agent-central-hub,
  .agent-sector-head,
  .agent-sector-flow-summary {
    grid-template-columns: 1fr;
  }

  .agent-central-icon {
    height: 48px;
    width: 48px;
  }

  .agent-data-bus {
    margin-left: 4px;
    margin-right: 4px;
  }

  .agent-sector-grid {
    grid-template-columns: 1fr;
  }
}

.agent-workflow-panel {
  overflow: visible;
}

.agent-workflow-canvas {
  background-color: #0b0713;
  background-image:
    radial-gradient(circle, rgba(166,151,198,0.22) 1px, transparent 1px),
    radial-gradient(circle at 22% 18%, rgba(201,169,110,0.13), transparent 28%),
    radial-gradient(circle at 88% 36%, rgba(74,222,128,0.08), transparent 24%);
  background-size: 18px 18px, 100% 100%, 100% 100%;
  border-radius: 0 0 16px 16px;
  color: #f8fafc;
  min-height: 720px;
  overflow: auto;
  padding: 28px;
  position: relative;
}

.agent-org-grid-full .agent-workflow-canvas {
  min-height: 820px;
}

.agent-workflow-canvas::before {
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  content: "";
  inset: 14px;
  pointer-events: none;
  position: absolute;
}

.agent-workflow-mainline {
  align-items: center;
  display: flex;
  gap: 0;
  justify-content: center;
  min-width: 1260px;
  padding: 10px 8px 34px;
  position: relative;
  z-index: 2;
}

.agent-workflow-node,
.agent-workflow-sector-node,
.agent-workflow-agent-node {
  background: rgba(38,34,48,0.96);
  border: 1px solid rgba(188,181,207,0.64);
  border-radius: 10px;
  box-shadow: 0 18px 45px rgba(0,0,0,0.32);
  color: #f8fafc;
  position: relative;
}

.agent-workflow-node {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: 44px minmax(0,1fr);
  min-height: 86px;
  min-width: 214px;
  padding: 15px 16px;
}

.agent-workflow-central {
  border-color: rgba(232,201,135,0.72);
  box-shadow:
    0 0 0 1px rgba(232,201,135,0.16),
    0 0 50px rgba(232,201,135,0.16),
    0 22px 56px rgba(0,0,0,0.4);
  grid-template-columns: 72px minmax(0,1fr);
  min-height: 132px;
  min-width: 430px;
}

.agent-workflow-central::before {
  animation: agentBrainGlow 3s ease-in-out infinite;
  border: 1px solid rgba(232,201,135,0.26);
  border-radius: 15px;
  content: "";
  inset: -8px;
  opacity: 0.6;
  pointer-events: none;
  position: absolute;
}

@keyframes agentBrainGlow {
  0%, 100% { opacity: 0.32; transform: scale(0.99); }
  50% { opacity: 0.82; transform: scale(1.02); }
}

.agent-workflow-trigger {
  border-color: rgba(201,169,110,0.64);
}

.agent-workflow-router {
  border-color: rgba(74,222,128,0.56);
}

.agent-workflow-icon,
.agent-workflow-sector-icon {
  align-items: center;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px;
  display: flex;
  height: 44px;
  justify-content: center;
  width: 44px;
}

.agent-workflow-trigger .agent-workflow-icon {
  color: #f59e0b;
}

.agent-workflow-central .agent-workflow-icon {
  color: #e8c987;
}

.agent-workflow-central .agent-workflow-icon {
  background:
    radial-gradient(circle at 50% 50%, rgba(232,201,135,0.24), rgba(232,201,135,0.08)),
    rgba(255,255,255,0.07);
  border-color: rgba(232,201,135,0.28);
  border-radius: 18px;
  height: 72px;
  width: 72px;
}

.agent-workflow-router .agent-workflow-icon,
.agent-workflow-sector-icon {
  color: #4ade80;
}

.agent-workflow-copy,
.agent-workflow-agent-copy,
.agent-workflow-sector-node > div:nth-child(3) {
  min-width: 0;
}

.agent-workflow-copy small,
.agent-workflow-sector-node small {
  color: rgba(248,250,252,0.58);
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0;
}

.agent-workflow-copy strong,
.agent-workflow-sector-node strong,
.agent-workflow-agent-copy strong {
  color: #fff;
  display: block;
  font-size: 0.92rem;
  line-height: 1.2;
  margin-top: 2px;
}

.agent-workflow-copy span,
.agent-workflow-sector-node p,
.agent-workflow-agent-copy p {
  color: rgba(248,250,252,0.62);
  display: block;
  font-size: 0.74rem;
  line-height: 1.3;
  margin: 4px 0 0;
}

.agent-workflow-node-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  grid-column: 1 / -1;
  margin-top: 2px;
}

.agent-workflow-brain-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  grid-column: 1 / -1;
}

.agent-workflow-brain-flow span {
  align-items: center;
  background: rgba(232,201,135,0.1);
  border: 1px solid rgba(232,201,135,0.16);
  border-radius: 999px;
  color: rgba(255,247,218,0.88);
  display: inline-flex;
  font-size: 0.68rem;
  font-weight: 850;
  gap: 5px;
  padding: 6px 8px;
}

.agent-workflow-node-stats span {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  color: rgba(248,250,252,0.72);
  font-size: 0.68rem;
  font-weight: 800;
  padding: 5px 8px;
}

.agent-workflow-port {
  background: #a9a3ba;
  border: 1px solid rgba(255,255,255,0.34);
  border-radius: 999px;
  height: 12px;
  position: absolute;
  top: calc(50% - 6px);
  width: 12px;
  z-index: 4;
}

.agent-workflow-port-left {
  left: -7px;
}

.agent-workflow-port-right {
  right: -7px;
}

.agent-workflow-connector {
  background: rgba(188,181,207,0.54);
  flex: 0 0 86px;
  height: 2px;
  overflow: hidden;
  position: relative;
}

.agent-workflow-connector::before {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
  content: "";
  height: 1px;
  left: 0;
  position: absolute;
  right: 0;
  top: -5px;
}

.agent-workflow-connector span {
  animation: agentWorkflowPulse 2.8s linear infinite;
  background: #4ade80;
  border-radius: 999px;
  box-shadow: 0 0 12px rgba(74,222,128,0.82);
  height: 6px;
  left: 0;
  position: absolute;
  top: -2px;
  width: 16px;
}

@keyframes agentWorkflowPulse {
  from { left: -18px; opacity: 0; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  to { left: calc(100% + 18px); opacity: 0; }
}

.agent-workflow-data-row {
  align-items: start;
  display: flex;
  gap: 28px;
  justify-content: center;
  min-width: 1260px;
  padding: 0 0 24px;
  position: relative;
  z-index: 1;
}

.agent-workflow-data-node {
  display: grid;
  gap: 8px;
  justify-items: center;
  position: relative;
  width: 102px;
}

.agent-workflow-data-line {
  border-left: 2px dashed rgba(188,181,207,0.44);
  height: 58px;
  position: relative;
  width: 1px;
}

.agent-workflow-data-line::after {
  animation: agentWorkflowVertical 2.8s linear infinite;
  animation-delay: var(--flow-delay);
  background: #e8c987;
  border-radius: 999px;
  box-shadow: 0 0 12px rgba(232,201,135,0.75);
  content: "";
  height: 10px;
  left: -5px;
  position: absolute;
  top: 0;
  width: 10px;
}

@keyframes agentWorkflowVertical {
  from { top: 0; opacity: 0.18; }
  22% { opacity: 1; }
  80% { opacity: 1; }
  to { top: 48px; opacity: 0.18; }
}

.agent-workflow-data-node > div {
  align-items: center;
  background: rgba(38,34,48,0.94);
  border: 1px solid rgba(188,181,207,0.58);
  border-radius: 999px;
  color: #e8c987;
  display: flex;
  height: 58px;
  justify-content: center;
  width: 58px;
}

.agent-workflow-data-node strong {
  color: rgba(248,250,252,0.86);
  font-size: 0.74rem;
  line-height: 1.2;
  text-align: center;
}

.agent-workflow-brain-bus {
  height: 74px;
  min-width: 1260px;
  position: relative;
  z-index: 1;
}

.agent-workflow-brain-bus::before {
  background: linear-gradient(180deg, rgba(232,201,135,0.52), rgba(74,222,128,0.28));
  border-radius: 999px;
  content: "";
  height: 48px;
  left: 50%;
  position: absolute;
  top: 0;
  width: 2px;
}

.agent-workflow-brain-bus::after {
  background: linear-gradient(90deg, rgba(232,201,135,0.08), rgba(232,201,135,0.38), rgba(74,222,128,0.28), rgba(96,165,250,0.22), rgba(232,201,135,0.08));
  border-radius: 999px;
  bottom: 16px;
  content: "";
  height: 2px;
  left: 18px;
  position: absolute;
  right: 18px;
}

.agent-workflow-brain-packet {
  border-radius: 999px;
  bottom: 11px;
  height: 12px;
  position: absolute;
  width: 12px;
}

.agent-workflow-brain-packet-out {
  animation: agentBrainPacketOut 4s linear infinite;
  background: #4ade80;
  box-shadow: 0 0 14px rgba(74,222,128,0.82);
}

.agent-workflow-brain-packet-in {
  animation: agentBrainPacketIn 4s linear infinite;
  background: #e8c987;
  box-shadow: 0 0 14px rgba(232,201,135,0.82);
}

@keyframes agentBrainPacketOut {
  from { left: 50%; opacity: 0.18; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  to { left: calc(100% - 28px); opacity: 0.18; }
}

@keyframes agentBrainPacketIn {
  from { left: 18px; opacity: 0.18; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  to { left: 50%; opacity: 0.18; }
}

.agent-workflow-branches {
  display: grid;
  gap: 22px;
  min-width: 1260px;
  padding-left: 46px;
  padding-right: 72px;
  position: relative;
  z-index: 2;
}

.agent-workflow-branches::before {
  background: linear-gradient(180deg, rgba(232,201,135,0.36), rgba(74,222,128,0.28), rgba(96,165,250,0.24));
  border-radius: 999px;
  bottom: 48px;
  content: "";
  left: 18px;
  position: absolute;
  top: -32px;
  width: 2px;
}

.agent-workflow-branches::after {
  background: linear-gradient(180deg, rgba(232,201,135,0.5), rgba(74,222,128,0.28), rgba(96,165,250,0.26), rgba(232,201,135,0.42));
  border-radius: 999px;
  bottom: 48px;
  content: "";
  position: absolute;
  right: 28px;
  top: -32px;
  width: 2px;
}

.agent-workflow-return-spine {
  bottom: 48px;
  pointer-events: none;
  position: absolute;
  right: 28px;
  top: -32px;
  width: 2px;
  z-index: 2;
}

.agent-workflow-return-spine::before {
  background: rgba(188,181,207,0.46);
  content: "";
  height: 2px;
  position: absolute;
  right: 0;
  top: 0;
  width: calc(50% + 590px);
}

.agent-workflow-return-spine::after {
  background: linear-gradient(90deg, rgba(232,201,135,0.46), rgba(232,201,135,0.18), transparent);
  content: "";
  height: 2px;
  position: absolute;
  right: 0;
  top: -32px;
  width: calc(50% + 590px);
}

.agent-workflow-return-packet {
  border-radius: 999px;
  height: 10px;
  left: -4px;
  position: absolute;
  width: 10px;
}

.agent-workflow-return-packet-up {
  animation: agentReturnUp 4.6s linear infinite;
  background: #e8c987;
  box-shadow: 0 0 14px rgba(232,201,135,0.84);
}

.agent-workflow-return-packet-down {
  animation: agentReturnDown 4.6s linear infinite;
  background: #4ade80;
  box-shadow: 0 0 14px rgba(74,222,128,0.78);
}

@keyframes agentReturnUp {
  from { bottom: 0; opacity: 0.16; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  to { bottom: calc(100% - 10px); opacity: 0.16; }
}

@keyframes agentReturnDown {
  from { top: 0; opacity: 0.16; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  to { top: calc(100% - 10px); opacity: 0.16; }
}

.agent-workflow-branch {
  align-items: center;
  display: grid;
  gap: 0;
  grid-template-columns: 250px 72px minmax(0,1fr) 72px;
  position: relative;
}

.agent-workflow-branch::before {
  background: rgba(188,181,207,0.54);
  content: "";
  height: 2px;
  left: -28px;
  position: absolute;
  top: 50%;
  width: 28px;
}

.agent-workflow-branch::after {
  animation: agentBranchPacket 3.2s linear infinite;
  animation-delay: var(--flow-delay);
  background: #e8c987;
  border-radius: 999px;
  box-shadow: 0 0 12px rgba(232,201,135,0.78);
  content: "";
  height: 8px;
  left: -30px;
  position: absolute;
  top: calc(50% - 4px);
  width: 8px;
}

@keyframes agentBranchPacket {
  from { left: -32px; opacity: 0.16; }
  24% { opacity: 1; }
  78% { opacity: 1; }
  to { left: 4px; opacity: 0.16; }
}

.agent-workflow-sector-node {
  align-items: center;
  display: grid;
  gap: 11px;
  grid-template-columns: 44px minmax(0,1fr) auto;
  min-height: 92px;
  padding: 13px 15px;
}

.agent-workflow-sector-node.pilger-ai-tone-success,
.agent-workflow-sector-node.pilger-ai-tone-warning,
.agent-workflow-sector-node.pilger-ai-tone-danger,
.agent-workflow-sector-node.pilger-ai-tone-info,
.agent-workflow-sector-node.pilger-ai-tone-muted {
  background: rgba(38,34,48,0.96);
  color: #f8fafc;
}

.agent-workflow-sector-count {
  align-items: center;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  color: rgba(248,250,252,0.82);
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 900;
  gap: 5px;
  padding: 6px 8px;
  white-space: nowrap;
}

.agent-workflow-branch-connector {
  flex-basis: auto;
  width: 72px;
}

.agent-workflow-agent-chain {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  min-width: 0;
  position: relative;
}

.agent-workflow-agent-chain::after {
  background: rgba(188,181,207,0.42);
  content: "";
  height: 2px;
  position: absolute;
  right: -18px;
  top: 50%;
  width: 18px;
}

.agent-workflow-return-connector {
  background: rgba(188,181,207,0.54);
  height: 2px;
  overflow: hidden;
  position: relative;
  width: 72px;
}

.agent-workflow-return-connector::after {
  background: #a9a3ba;
  border: 1px solid rgba(255,255,255,0.34);
  border-radius: 999px;
  content: "";
  height: 12px;
  position: absolute;
  right: -7px;
  top: -5px;
  width: 12px;
  z-index: 3;
}

.agent-workflow-return-connector span {
  animation: agentWorkflowReturnPulse 3.2s linear infinite;
  background: #e8c987;
  border-radius: 999px;
  box-shadow: 0 0 12px rgba(232,201,135,0.82);
  height: 6px;
  left: -14px;
  position: absolute;
  top: -2px;
  width: 16px;
}

@keyframes agentWorkflowReturnPulse {
  from { left: -18px; opacity: 0; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  to { left: calc(100% + 18px); opacity: 0; }
}

.agent-workflow-agent-node {
  align-items: center;
  display: grid;
  gap: 8px 11px;
  grid-template-columns: 48px minmax(0,1fr);
  min-height: 98px;
  overflow: visible;
  padding: 11px 13px;
  width: 238px;
}

.agent-workflow-agent-node::before {
  animation: agentWorkflowPulse 3.4s linear infinite;
  animation-delay: var(--flow-delay);
  background: #4ade80;
  border-radius: 999px;
  box-shadow: 0 0 12px rgba(74,222,128,0.82);
  content: "";
  height: 6px;
  left: -18px;
  position: absolute;
  top: calc(50% - 3px);
  width: 14px;
}

.agent-workflow-agent-node.pilger-ai-tone-success,
.agent-workflow-agent-node.pilger-ai-tone-warning,
.agent-workflow-agent-node.pilger-ai-tone-danger,
.agent-workflow-agent-node.pilger-ai-tone-info,
.agent-workflow-agent-node.pilger-ai-tone-muted {
  background: rgba(38,34,48,0.96);
  color: #f8fafc;
}

.agent-workflow-agent-node.pilger-ai-tone-success { border-color: rgba(74,222,128,0.58); }
.agent-workflow-agent-node.pilger-ai-tone-warning { border-color: rgba(245,158,11,0.6); }
.agent-workflow-agent-node.pilger-ai-tone-danger { border-color: rgba(248,113,113,0.58); }
.agent-workflow-agent-node.pilger-ai-tone-info { border-color: rgba(96,165,250,0.56); }

.agent-workflow-avatar {
  align-items: center;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  color: #e8c987;
  display: flex;
  font-size: 0.76rem;
  font-weight: 900;
  height: 48px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 48px;
}

.agent-workflow-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.agent-workflow-status-dot {
  border: 2px solid #262230;
  border-radius: 999px;
  bottom: 0;
  height: 13px;
  position: absolute;
  right: 0;
  width: 13px;
}

.agent-workflow-status-dot.pilger-ai-tone-success { background: #22c55e; }
.agent-workflow-status-dot.pilger-ai-tone-warning { background: #f59e0b; }
.agent-workflow-status-dot.pilger-ai-tone-danger { background: #ef4444; }
.agent-workflow-status-dot.pilger-ai-tone-info { background: #60a5fa; }
.agent-workflow-status-dot.pilger-ai-tone-muted { background: #94a3b8; }

.agent-workflow-agent-copy {
  min-width: 0;
}

.agent-workflow-agent-copy strong,
.agent-workflow-agent-copy small,
.agent-workflow-agent-copy p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-workflow-agent-copy small {
  color: rgba(232,201,135,0.92);
  font-size: 0.64rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  margin-top: 2px;
  text-transform: uppercase;
}

.agent-workflow-agent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  grid-column: 1 / -1;
}

.agent-workflow-agent-tags span {
  align-items: center;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  color: rgba(248,250,252,0.76);
  display: inline-flex;
  font-size: 0.66rem;
  font-weight: 800;
  gap: 4px;
  padding: 5px 7px;
}

.agent-workflow-canvas .agent-org-tooltip {
  background: rgba(19,16,27,0.98);
  border: 1px solid rgba(232,201,135,0.38);
  box-shadow: 0 18px 50px rgba(0,0,0,0.48);
  color: #fff;
  left: 50%;
  width: 300px;
}

.agent-workflow-canvas .agent-org-tooltip small {
  color: #e8c987;
}

.agent-workflow-canvas .agent-org-tooltip p,
.agent-workflow-canvas .agent-org-tooltip div span {
  color: rgba(248,250,252,0.72);
}

.agent-workflow-agent-node:hover .agent-org-tooltip,
.agent-workflow-agent-node:focus .agent-org-tooltip,
.agent-workflow-agent-node:focus-within .agent-org-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.agent-workflow-branch.pilger-ai-tone-success .agent-workflow-sector-node { border-color: rgba(74,222,128,0.58); }
.agent-workflow-branch.pilger-ai-tone-warning .agent-workflow-sector-node { border-color: rgba(245,158,11,0.6); }
.agent-workflow-branch.pilger-ai-tone-danger .agent-workflow-sector-node { border-color: rgba(248,113,113,0.58); }
.agent-workflow-branch.pilger-ai-tone-info .agent-workflow-sector-node { border-color: rgba(96,165,250,0.56); }

@media (max-width: 1180px) {
  .agent-workflow-canvas {
    padding: 22px;
  }

  .agent-workflow-mainline,
  .agent-workflow-data-row,
  .agent-workflow-brain-bus,
  .agent-workflow-branches {
    min-width: 1040px;
  }

  .agent-workflow-branch {
    grid-template-columns: 230px 60px minmax(0,1fr) 60px;
  }

  .agent-workflow-branch-connector,
  .agent-workflow-return-connector {
    width: 60px;
  }
}

@media (max-width: 720px) {
  .agent-workflow-canvas {
    padding: 18px;
  }

  .agent-workflow-mainline,
  .agent-workflow-data-row,
  .agent-workflow-brain-bus,
  .agent-workflow-branches {
    min-width: 780px;
  }

  .agent-workflow-node {
    min-width: 190px;
  }

  .agent-workflow-central {
    min-width: 260px;
  }

  .agent-workflow-data-row {
    justify-content: flex-start;
  }
}

.agent-graph-panel {
  overflow: hidden;
}

.agent-graph-panel .agent-org-head-compact {
  align-items: center;
  padding: 12px 18px;
}

.agent-graph-panel .agent-org-head-compact h2 {
  font-size: 0.92rem;
}

.agent-graph-panel .agent-org-head-compact span {
  font-size: 0.62rem;
  margin-bottom: 3px;
}

.agent-graph-panel .agent-org-head-compact .agent-org-head-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.agent-graph-canvas {
  background:
    radial-gradient(circle at 50% 50%, rgba(74,158,255,0.08), transparent 35%),
    #0D1117;
  border-radius: 16px;
  border: 1px solid rgba(74,158,255,0.22);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.04),
    inset 0 0 120px rgba(0,0,0,0.56),
    0 30px 70px rgba(15,23,42,0.22);
  cursor: grab;
  height: clamp(900px, 88vh, 1320px);
  overflow: hidden;
  position: relative;
}

.agent-graph-canvas.is-panning {
  cursor: grabbing;
}

.agent-graph-controls {
  display: grid;
  gap: 8px;
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 20;
}

.agent-graph-stage {
  --agent-node-scale: 1;
  background-color: #0D1117;
  background-image:
    radial-gradient(circle at 50% 50%, rgba(74,158,255,0.16) 0%, rgba(0,212,170,0.08) 20%, transparent 44%),
    radial-gradient(circle, rgba(74,158,255,0.075) 1px, transparent 1.25px),
    linear-gradient(rgba(74,158,255,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(74,158,255,0.035) 1px, transparent 1px);
  background-size: 100% 100%, 22px 22px, 110px 110px, 110px 110px;
  left: 0;
  overflow: visible;
  position: absolute;
  top: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.agent-graph-stage::before,
.agent-graph-stage::after {
  border-radius: 0;
  content: "";
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 0;
}

.agent-graph-stage::before {
  background:
    radial-gradient(circle at 50% 50%, transparent 0 13%, rgba(240,208,96,0.18) 13.05% 13.16%, transparent 13.24% 23%, rgba(74,158,255,0.16) 23.05% 23.16%, transparent 23.24% 34%, rgba(0,212,170,0.12) 34.05% 34.16%, transparent 34.24%),
    linear-gradient(90deg, transparent 0 49.98%, rgba(240,208,96,0.12) 49.98% 50.02%, transparent 50.02%),
    linear-gradient(0deg, transparent 0 49.98%, rgba(240,208,96,0.1) 49.98% 50.02%, transparent 50.02%);
  opacity: 0.82;
}

.agent-graph-stage::after {
  background:
    radial-gradient(ellipse at 50% 50%, transparent 0 38%, rgba(2,6,15,0.42) 76%),
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent 24%, rgba(0,0,0,0.28));
  opacity: 1;
}

.agent-graph-links {
  height: 100%;
  inset: 0;
  overflow: visible;
  pointer-events: none;
  position: absolute;
  width: 100%;
  z-index: 2;
}

.agent-graph-center-glow {
  fill: url(#agentGraphGlow);
  opacity: 0.86;
}

.agent-graph-link {
  fill: none;
  opacity: 0.68;
  stroke: var(--link-color, #4A9EFF);
  stroke-dasharray: 8 10;
  stroke-linecap: round;
  stroke-width: 2.05;
  transition: filter 0.18s ease, opacity 0.18s ease, stroke 0.18s ease, stroke-width 0.18s ease;
  filter: drop-shadow(0 0 3px var(--link-color, #4A9EFF));
}

.agent-graph-link-input {
  stroke-width: 2.35;
}

.agent-graph-link-memory,
.agent-graph-link-sync {
  stroke-width: 1.8;
}

.agent-graph-link-sector {
  stroke-width: 2.4;
}

.agent-graph-link-agent {
  stroke-width: 1.9;
}

.agent-graph-link-return {
  stroke-width: 1.9;
}

.agent-graph-link-inbound {
  stroke-dasharray: 6 12;
}

.agent-graph-link-entry {
  stroke-dasharray: 9 9;
}

.agent-graph-link.is-dimmed {
  opacity: 0.12;
  filter: none;
}

.agent-graph-link.is-highlighted {
  filter: drop-shadow(0 0 8px var(--link-color, #4A9EFF));
  opacity: 1;
  stroke-width: 3.2;
}

.agent-graph-node {
  animation: agentGraphNodeEnter 0.42s cubic-bezier(.2,.8,.2,1) both;
  animation-delay: var(--node-delay, 0ms);
  cursor: pointer;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  position: absolute;
  touch-action: none;
  transform: translate(-50%, -50%) scale(var(--agent-node-scale, 1));
  transition: filter 0.18s ease, opacity 0.18s ease;
  user-select: none;
  z-index: 4;
}

.agent-graph-node.is-dragging {
  cursor: grabbing;
  z-index: 30;
}

.agent-graph-node.is-dimmed {
  filter: grayscale(0.35);
  opacity: 0.28;
}

.agent-graph-node.is-related {
  opacity: 1;
}

.agent-graph-node.is-focused {
  filter: drop-shadow(0 0 20px var(--node-accent, #4A9EFF));
  opacity: 1;
}

@keyframes agentGraphNodeEnter {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(calc(var(--agent-node-scale, 1) * 0.72));
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(var(--agent-node-scale, 1));
  }
}

.agent-graph-central {
  align-items: center;
  animation:
    agentGraphNodeEnter 0.42s cubic-bezier(.2,.8,.2,1) both,
    agentGraphHubPulse 3s ease-in-out infinite;
  background:
    linear-gradient(#1A1F2E, #1A1F2E) padding-box,
    linear-gradient(135deg, #C9A227, #F0D060) border-box;
  border: 2px solid transparent;
  border-radius: 999px;
  box-shadow:
    0 0 0 10px rgba(201,162,39,0.08),
    0 0 42px rgba(240,208,96,0.34),
    0 0 120px rgba(74,158,255,0.28),
    0 24px 70px rgba(0,0,0,0.48);
  color: #FFFFFF;
  display: grid;
  height: 214px;
  justify-items: center;
  padding: 24px;
  text-align: center;
  width: 214px;
}

.agent-graph-orbit {
  border: 1px solid rgba(240,208,96,0.28);
  border-radius: 999px;
  inset: -22px;
  pointer-events: none;
  position: absolute;
}

.agent-graph-orbit-one {
  animation: agentGraphOrbit 13s linear infinite;
}

.agent-graph-orbit-two {
  animation: agentGraphOrbit 17s linear infinite reverse;
  border-color: rgba(74,158,255,0.22);
  inset: -42px;
}

@keyframes agentGraphOrbit {
  from { transform: rotate(0deg) scale(1); }
  to { transform: rotate(360deg) scale(1.02); }
}

@keyframes agentGraphHubPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(var(--agent-node-scale, 1)); }
  50% { transform: translate(-50%, -50%) scale(calc(var(--agent-node-scale, 1) * 1.03)); }
}

.agent-graph-brain {
  align-items: center;
  background: rgba(240,208,96,0.1);
  border: 1px solid rgba(240,208,96,0.28);
  border-radius: 999px;
  color: #F0D060;
  display: flex;
  height: 72px;
  justify-content: center;
  width: 72px;
}

.agent-graph-central strong,
.agent-graph-trigger strong,
.agent-graph-data strong,
.agent-graph-sector strong,
.agent-graph-agent strong {
  color: #E8EAF0;
  display: block;
  line-height: 1.15;
}

.agent-graph-central strong {
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  margin-top: 4px;
}

.agent-graph-central small {
  color: #8B9CB8;
  display: block;
  font-size: 11px;
  line-height: 1.28;
  max-width: 160px;
}

.agent-graph-central > div:last-child {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}

.agent-graph-central > div:last-child span {
  background: rgba(240,208,96,0.1);
  border: 1px solid rgba(240,208,96,0.18);
  border-radius: 999px;
  color: #F0D060;
  font-size: 0.62rem;
  font-weight: 850;
  padding: 4px 6px;
}

.agent-graph-trigger,
.agent-graph-data,
.agent-graph-sector {
  align-items: center;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.055), transparent 42%),
    #1E2435;
  border: 1px solid #2A3352;
  border-left: 3px solid var(--node-accent, #4A9EFF);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.07),
    0 18px 42px rgba(0,0,0,0.28),
    0 0 22px color-mix(in srgb, var(--node-accent, #4A9EFF) 22%, transparent);
  color: #E8EAF0;
  display: grid;
  gap: 10px;
  grid-template-columns: 28px minmax(0, 1fr);
  justify-items: start;
  min-width: 154px;
  padding: 10px 12px;
  text-align: left;
}

.agent-graph-trigger {
  border-radius: 8px;
  min-width: 168px;
}

.agent-graph-trigger svg {
  color: var(--node-accent, #F59E0B);
}

.agent-graph-trigger strong {
  font-size: 13px;
  font-weight: 600;
}

.agent-graph-trigger small,
.agent-graph-data small,
.agent-graph-sector small,
.agent-graph-agent small {
  color: #6B7A99;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
}

.agent-graph-data {
  border-left-color: var(--node-accent, #F0D060);
  border-radius: 8px;
  min-width: 128px;
}

.agent-graph-data strong {
  font-size: 13px;
  font-weight: 600;
}

.agent-graph-data svg {
  color: var(--node-accent, #F0D060);
}

.agent-graph-sector {
  border-radius: 8px;
  min-width: 150px;
}

.agent-graph-sector svg {
  color: var(--node-accent, #00D4AA);
}

.agent-graph-sector strong {
  color: #E8EAF0;
  font-size: 13px;
  font-weight: 600;
}

.agent-graph-sector.is-collapsed {
  opacity: 0.74;
}

.agent-graph-sector.is-collapsed small {
  color: #F0D060;
}

.agent-graph-sector.pilger-ai-tone-success,
.agent-graph-sector.pilger-ai-tone-warning,
.agent-graph-sector.pilger-ai-tone-danger,
.agent-graph-sector.pilger-ai-tone-info,
.agent-graph-sector.pilger-ai-tone-muted {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.055), transparent 42%),
    #1E2435;
  color: #E8EAF0;
}

.agent-graph-sector.pilger-ai-tone-success,
.agent-graph-sector.pilger-ai-tone-warning,
.agent-graph-sector.pilger-ai-tone-danger,
.agent-graph-sector.pilger-ai-tone-info,
.agent-graph-sector.pilger-ai-tone-muted {
  border-color: #2A3352;
  border-left-color: var(--node-accent, #00D4AA);
}

.agent-graph-agent {
  align-items: center;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.045), transparent 48%),
    #161B27 !important;
  border: 1px solid #2A3352;
  border-left: 3px solid var(--node-accent, #4A9EFF);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    0 14px 32px rgba(0,0,0,0.3);
  color: #E8EAF0 !important;
  display: grid;
  gap: 10px;
  grid-template-columns: 44px minmax(0, 1fr);
  justify-items: stretch;
  padding: 8px 10px;
  text-align: left;
  width: 198px;
}

.agent-graph-avatar-wrap {
  align-items: center;
  display: flex;
  height: 44px;
  justify-content: center;
}

.agent-graph-avatar {
  align-items: center;
  background: #0D1117;
  border: 2px solid var(--node-accent, #4A9EFF);
  border-radius: 999px;
  box-shadow:
    0 0 0 3px rgba(255,255,255,0.05),
    0 0 16px color-mix(in srgb, var(--node-accent, #4A9EFF) 36%, transparent);
  color: #E8EAF0;
  display: flex;
  font-size: 0.76rem;
  font-weight: 900;
  height: 40px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 40px;
}

.agent-graph-agent.pilger-ai-tone-success .agent-graph-avatar,
.agent-graph-agent.pilger-ai-tone-warning .agent-graph-avatar,
.agent-graph-agent.pilger-ai-tone-danger .agent-graph-avatar,
.agent-graph-agent.pilger-ai-tone-info .agent-graph-avatar {
  border-color: var(--node-accent, #4A9EFF);
}

.agent-graph-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.agent-graph-status {
  border: 2px solid #161B27;
  border-radius: 999px;
  bottom: -1px;
  height: 11px;
  position: absolute;
  right: -1px;
  width: 11px;
}

.agent-graph-status.pilger-ai-tone-success { background: #22c55e; }
.agent-graph-status.pilger-ai-tone-warning { background: #f59e0b; }
.agent-graph-status.pilger-ai-tone-danger { background: #ef4444; }
.agent-graph-status.pilger-ai-tone-info { background: #60a5fa; }
.agent-graph-status.pilger-ai-tone-muted { background: #94a3b8; }

.agent-graph-agent-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.agent-graph-agent strong {
  background: transparent;
  border: 0;
  box-shadow: none;
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 600;
  max-width: 130px;
  overflow: hidden;
  padding: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-graph-agent small {
  background: transparent;
  color: #8B9CB8;
  max-width: 130px;
  overflow: hidden;
  padding: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-graph-tooltip {
  background: rgba(13,17,23,0.96);
  border: 1px solid #2A3352;
  border-radius: 13px;
  bottom: calc(100% + 12px);
  box-shadow:
    0 22px 60px rgba(0,0,0,0.46),
    0 0 28px color-mix(in srgb, var(--node-accent, #4A9EFF) 24%, transparent);
  color: #E8EAF0;
  display: grid;
  gap: 7px;
  left: 50%;
  opacity: 0;
  padding: 12px;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, 8px);
  transition: opacity 0.16s ease, transform 0.16s ease;
  width: 300px;
  z-index: 40;
}

.agent-graph-node:hover .agent-graph-tooltip,
.agent-graph-node:focus .agent-graph-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.agent-graph-tooltip small {
  color: var(--node-accent, #F0D060);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.agent-graph-tooltip p,
.agent-graph-tooltip div span {
  color: #8B9CB8;
  font-size: 0.72rem;
  line-height: 1.3;
}

.agent-graph-tooltip div {
  display: grid;
  gap: 5px;
}

.agent-graph-hud {
  align-items: center;
  display: flex;
  gap: 8px;
  left: 16px;
  position: absolute;
  top: 16px;
  z-index: 5;
}

.agent-graph-hud span,
.agent-graph-control {
  align-items: center;
  background: rgba(13,17,23,0.82);
  border: 1px solid #2A3352;
  border-radius: 999px;
  color: #E8EAF0;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 850;
  gap: 6px;
  padding: 8px 10px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.28);
}

.agent-graph-hud svg,
.agent-graph-control svg {
  color: #F0D060;
}

.agent-graph-reset {
  height: 34px;
  justify-content: center;
  padding: 0;
  width: 34px;
}

.agent-graph-controls .agent-graph-control {
  height: 34px;
  justify-content: center;
  padding: 0;
  width: 34px;
}

.agent-graph-size-control {
  align-items: center;
  background: rgba(13,17,23,0.82);
  border: 1px solid #2A3352;
  border-radius: 999px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.28);
  color: #E8EAF0;
  display: flex;
  gap: 4px;
  padding: 4px;
}

.agent-graph-size-control .agent-graph-control {
  background: rgba(30,36,53,0.94);
  border-color: rgba(74,158,255,0.24);
  color: #E8EAF0;
  font-size: 0.64rem;
  font-weight: 900;
  height: 30px;
  width: 34px;
}

.agent-graph-size-control span {
  color: #8B9CB8;
  font-size: 0.68rem;
  font-weight: 850;
  min-width: 38px;
  text-align: center;
}

.agent-graph-control:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.agent-graph-control:hover {
  background: rgba(30,36,53,0.94);
  border-color: rgba(74,158,255,0.48);
  color: #FFFFFF;
}

.agent-graph-particle {
  fill: #FFFFFF;
  filter:
    drop-shadow(0 0 4px #FFFFFF)
    drop-shadow(0 0 10px var(--particle-color, #4A9EFF));
  opacity: 0.92;
  pointer-events: none;
  stroke: var(--particle-color, #4A9EFF);
  stroke-width: 2.2;
}

.agent-graph-particle.is-dimmed {
  opacity: 0.16;
}

.agent-graph-gold-particle {
  animation: agentGraphGoldPulse 1.6s ease-in-out infinite;
  fill: #F0D060;
  filter:
    drop-shadow(0 0 5px #FFFFFF)
    drop-shadow(0 0 12px #F0D060)
    drop-shadow(0 0 24px #C9A227);
  opacity: 0.98;
  pointer-events: none;
  stroke: #FFF7C2;
  stroke-width: 2.4;
}

.agent-graph-gold-particle.is-dimmed {
  opacity: 0.18;
}

@keyframes agentGraphGoldPulse {
  0%, 100% {
    filter:
      drop-shadow(0 0 4px #FFFFFF)
      drop-shadow(0 0 12px #F0D060)
      drop-shadow(0 0 22px #C9A227);
    opacity: 0.88;
  }
  50% {
    filter:
      drop-shadow(0 0 8px #FFFFFF)
      drop-shadow(0 0 20px #F0D060)
      drop-shadow(0 0 34px #C9A227);
    opacity: 1;
  }
}

.agent-graph-legend {
  align-items: center;
  background: rgba(13,17,23,0.8);
  border: 1px solid #2A3352;
  border-radius: 12px;
  bottom: 16px;
  box-shadow: 0 18px 42px rgba(0,0,0,0.32);
  color: #E8EAF0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  left: 16px;
  padding: 9px 11px;
  position: absolute;
  z-index: 10;
}

.agent-graph-legend span {
  align-items: center;
  color: #8B9CB8;
  display: inline-flex;
  font-size: 0.68rem;
  font-weight: 750;
  gap: 6px;
}

.agent-graph-legend i {
  background: var(--legend-color, #4A9EFF);
  border-radius: 999px;
  box-shadow: 0 0 12px var(--legend-color, #4A9EFF);
  display: inline-block;
  height: 8px;
  width: 8px;
}

@media (max-width: 1180px) {
  .agent-graph-canvas {
    height: clamp(760px, 84vh, 1100px);
  }
}

.pilger-ai-tone-success {
  background: rgba(34,197,94,0.13);
  color: #16a34a;
}

.pilger-ai-tone-warning {
  background: rgba(245,158,11,0.14);
  color: #b7791f;
}

.pilger-ai-tone-danger {
  background: rgba(239,68,68,0.13);
  color: #dc2626;
}

.pilger-ai-tone-info {
  background: rgba(59,130,246,0.12);
  color: #2563eb;
}

.pilger-ai-tone-muted {
  background: rgba(100,116,139,0.12);
  color: #64748b;
}
`

export default function PilgerAiStyles() {
  return (
    <style
      id="pilger-ai-styles"
      dangerouslySetInnerHTML={{ __html: PILGER_AI_CSS }}
    />
  )
}
