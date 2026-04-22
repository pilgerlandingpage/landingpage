const fs = require('fs');
const content = fs.readFileSync('app/admin/maintenance/page.tsx', 'utf8');

const headEndTag = '<div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: \'20px\' }}>';
const tailStartTag = '{/* Prompts dos Relatórios */}';

const targetStart = content.indexOf(headEndTag);
if(targetStart === -1) { console.error('not found 1'); process.exit(1); }

const targetEnd = content.indexOf(tailStartTag, targetStart);
if(targetEnd === -1) { console.error('not found 2'); process.exit(1); }

const head = content.substring(0, targetStart);
const tail = content.substring(targetEnd);

// Also we need to inject the HourGridSelector component right inside the component
// The component starts with: export default function MaintenancePage() {
const compStart = head.indexOf('export default function MaintenancePage() {');
const hrGrid = `
export default function MaintenancePage() {
    const HourGridSelector = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
        const selectedHours = (value || '').split(',').map(h => h.trim()).filter(Boolean)
        const toggleHour = (hour: string) => {
            if (selectedHours.includes(hour)) {
                 onChange(selectedHours.filter(h => h !== hour).sort((a,b) => parseInt(a)-parseInt(b)).join(','))
            } else {
                 onChange([...selectedHours, hour].sort((a,b) => parseInt(a)-parseInt(b)).join(','))
            }
        }
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {Array.from({ length: 24 }).map((_, i) => {
                    const hourStr = i.toString().padStart(2, '0')
                    const isSelected = selectedHours.includes(hourStr)
                    return (
                        <button
                            key={hourStr}
                            onClick={() => toggleHour(hourStr)}
                            type="button"
                            style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: \`1px solid \${isSelected ? 'var(--gold)' : 'var(--border-color)'}\`,
                                background: isSelected ? 'rgba(212, 175, 55, 0.1)' : 'var(--bg-primary)',
                                color: isSelected ? 'var(--gold)' : 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {hourStr}h
                        </button>
                    )
                })}
            </div>
        )
    }
`;

const updatedHead = head.replace('export default function MaintenancePage() {', hrGrid);

const replacement = `                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Diário */}
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Relatório Diário & Análise</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Selecione as horas em que deseja rodar o fechamento diário. Recomendado: 23h.
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <HourGridSelector 
                                    value={configs['pilger_daily_time'] || '23'} 
                                    onChange={v => setConfigs({ ...configs, pilger_daily_time: v })} 
                                />
                            </div>
                        </div>

                        {/* Semanal */}
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Diretriz Semanal Pilger AI</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Análise profunda. Escolha dia e horário.
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label className="form-label">Dia da Semana</label>
                                    <select className="form-input" value={configs['pilger_weekly_day'] || '1'} onChange={e => setConfigs({ ...configs, pilger_weekly_day: e.target.value })}>
                                        <option value="0">Domingo</option>
                                        <option value="1">Segunda-feira</option>
                                        <option value="2">Terça-feira</option>
                                        <option value="3">Quarta-feira</option>
                                        <option value="4">Quinta-feira</option>
                                        <option value="5">Sexta-feira</option>
                                        <option value="6">Sábado</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label className="form-label">Horário Fixo</label>
                                    <select className="form-input" value={configs['pilger_weekly_time'] || '23'} onChange={e => setConfigs({ ...configs, pilger_weekly_time: e.target.value })}>
                                        {Array.from({ length: 24 }).map((_, i) => (
                                            <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}:00</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px', marginBottom: '20px' }}>
                        {/* Radar de Mercado */}
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <TrendingUp size={18} style={{ color: 'var(--gold)' }} />
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Radar de Mercado</div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Rastreio de tendências. Padrão recomendado: 06, 12 e 18h.
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <HourGridSelector 
                                    value={configs['radar_collection_times'] || '06,12,18'} 
                                    onChange={v => setConfigs({ ...configs, radar_collection_times: v })} 
                                />
                            </div>
                        </div>
                    </div>

                    `;

fs.writeFileSync('app/admin/maintenance/page.tsx', updatedHead + replacement + tail);
console.log('done replacing section');
