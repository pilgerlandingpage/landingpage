const fs = require('fs');
const content = fs.readFileSync('app/admin/maintenance/page.tsx', 'utf8');

const anchor1 = '2. Agentes IA WhatsApp';
const anchor2 = '{/* ── 3. EXTRAÇÃO DE LEADS ── */}';

const idx1raw = content.indexOf(anchor1);
const idx2 = content.indexOf(anchor2);

if (idx1raw === -1 || idx2 === -1) {
    console.log('anchors not found');
    process.exit(1);
}

// Find the start of the <div style={{ marginBottom: ... before anchor1
const idx1 = content.lastIndexOf('<div style={{ marginBottom', idx1raw);

const head = content.substring(0, idx1);
const tail = content.substring(idx2);

const reconstructed = `<div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#22c55e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📱</span> 2. Agentes IA WhatsApp (Corretores)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Provedor dos Agentes WhatsApp</label>
                            <select
                                className="form-input"
                                value={configs['whatsapp_provider'] || ''}
                                onChange={e => setConfigs({ ...configs, whatsapp_provider: e.target.value })}
                            >
                                <option value="">Usar Padrão Global ({configs['ai_provider'] === 'openai' ? 'OpenAI' : 'Gemini'})</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo dos Agentes WhatsApp</label>
                            {(configs['whatsapp_provider'] === 'openai' || (!configs['whatsapp_provider'] && configs['ai_provider'] === 'openai')) ? (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['openai_whatsapp_model'] || ''} onChange={e => setConfigs({ ...configs, openai_whatsapp_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['gemini_whatsapp_model'] || ''} onChange={e => setConfigs({ ...configs, gemini_whatsapp_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Audio Config ── */}
                    <div style={{ marginTop: '8px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Volume2 size={16} style={{ color: '#22c55e' }} /> Provedor de Voz Global (TTS)
                                </label>
                                <select className="form-input" value={configs['whatsapp_tts_provider'] || 'elevenlabs'} onChange={e => setConfigs({ ...configs, whatsapp_tts_provider: e.target.value })}>
                                    <option value="elevenlabs">ElevenLabs (Premium + Clonagem)</option>
                                    <option value="openai">OpenAI TTS</option>
                                </select>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Este é o provedor base usado para configurar áudio. Na aba <b>Instâncias WhatsApp</b> você seleciona a voz específica para cada número e se a IA deve usar áudio.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.06)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.15)', marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            💡 O provedor e modelo escolhidos aqui serão usados por <strong>todos os agentes IA de WhatsApp</strong> (corretores). O prompt de cada agente é configurado individualmente na <strong>página de Corretores</strong>.
                        </div>
                    </div>
                </div>

                `;

fs.writeFileSync('app/admin/maintenance/page.tsx', head + reconstructed + tail);
console.log('Fixed WhatsApp Section');
