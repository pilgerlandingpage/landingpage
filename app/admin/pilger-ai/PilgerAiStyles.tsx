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
