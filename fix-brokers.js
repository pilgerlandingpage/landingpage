const fs = require('fs')

let code = fs.readFileSync('app/admin/brokers/page.tsx', 'utf8')

// Add config? to WhatsAppInstance
if (code.includes('virtual_brokers?: { name?: string | null } | null\n}')) {
    code = code.replace(
        'virtual_brokers?: { name?: string | null } | null\n}',
        'virtual_brokers?: { name?: string | null } | null\n    config?: any\n}'
    )
}

// Add isTextOnlyMode
if (code.includes('return (\n        <div className="admin-page-container">')) {
    code = code.replace(
        'return (\n        <div className="admin-page-container">',
        `const isTextOnlyMode = (() => {
        const currentInstance = availableInstances.find(inst => inst.id === selectedInstanceId) || whatsappInstance;
        return currentInstance?.config?.response_mode === 'text';
    })();

    return (
        <div className="admin-page-container">`
    )
}

// Disable select
if (code.includes('onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}\n                                    >')) {
    code = code.replace(
        'onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}\n                                    >',
        `onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                                        disabled={isTextOnlyMode}
                                        style={{ backgroundColor: isTextOnlyMode ? 'rgba(255,255,255,0.05)' : undefined }}
                                    >
                                        {isTextOnlyMode && (
                                            <optgroup label="⚠️ Desabilitado: Modo 'Sempre Texto'"></optgroup>
                                        )}`
    )
}

// Show Warning text
if (code.includes('{loadingVoices && <div style={{ fontSize: \'0.75rem\', color: \'var(--text-muted)\', marginTop: \'6px\' }}>⏳ Carregando vozes do ElevenLabs...</div>}')) {
    code = code.replace(
        '{loadingVoices && <div style={{ fontSize: \'0.75rem\', color: \'var(--text-muted)\', marginTop: \'6px\' }}>⏳ Carregando vozes do ElevenLabs...</div>}',
        `{isTextOnlyMode && (
                                        <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '6px', fontWeight: 600 }}>
                                            ⚠️ O Modo de Resposta desta instância de WhatsApp está configurado para 'Sempre Texto'. Modifique na aba Instâncias WhatsApp se quiser usar Voz.
                                        </div>
                                    )}
                                    {loadingVoices && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>⏳ Carregando vozes do ElevenLabs...</div>}`
    )
}

fs.writeFileSync('app/admin/brokers/page.tsx', code)
console.log('Fixed brokers admin page.')
