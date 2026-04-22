const fs = require('fs');
const content = fs.readFileSync('app/admin/maintenance/page.tsx', 'utf8');

const tStart = '                        <div className="form-group">\n                            <label className="form-label">Modelo dos Agentes WhatsApp</label>';
const tEnd = '{/* ── 3. EXTRAÇÃO DE LEADS ── */}';

const iStart = content.indexOf(tStart);
const iEnd = content.indexOf(tEnd);

if (iStart === -1 || iEnd === -1) { console.log('not found'); process.exit(1); }

const head = content.substring(0, iStart);
const tail = content.substring(iEnd);

const replacement = `                        <div className="form-group">
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
                                    Este é o provedor usado caso os agentes decidam responder por áudio. (Você configura se o agente usa áudio e qual a sua voz na aba de <b>Instâncias WhatsApp</b>).
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

fs.writeFileSync('app/admin/maintenance/page.tsx', head + replacement + tail);
console.log('done fixing jsx');
