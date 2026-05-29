'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquareText, Save, Trash2, UserPlus } from 'lucide-react'
import {
    DEFAULT_SECTOR_NOTIFICATION_EVENT_KEYS,
    DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES,
    SECTOR_NOTIFICATION_CONFIG_KEY,
    SECTOR_NOTIFICATION_EVENTS,
    getSectorNotificationRecipientsFromConfig,
    normalizeSectorPhone,
    type SectorNotificationMember,
    type SectorNotificationRecipient,
} from '@/lib/notifications/sector-recipients'

type SaveState = {
    status: 'idle' | 'saving' | 'success' | 'error'
    message: string
}

const DEFAULT_PROPERTY_REVIEW_MESSAGE_TEMPLATE = [
    '*Novo imovel aguardando analise*',
    '',
    'Setor: {setor}',
    'Responsavel: {responsavel}',
    '',
    'Imovel: {titulo}',
    'Local: {cidade}',
    'Valor: {valor}',
    'Status: Em analise',
    '',
    'Entre na sala de manutencao/admin para revisar, ajustar e publicar.',
].join('\n')
const ALLOWED_EVENT_KEYS = new Set<string>(DEFAULT_SECTOR_NOTIFICATION_EVENT_KEYS)

function getDefaultEventTypes(sectorKey: string) {
    return DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES[sectorKey] || DEFAULT_SECTOR_NOTIFICATION_EVENT_KEYS
}

function simplifyMember(member: SectorNotificationMember, index: number, fallbackEvents: string[]): SectorNotificationMember {
    const name = String(member.name || '').trim()
    const phone = String(member.phone || '').trim()
    const eventTypes = Array.isArray(member.event_types) && member.event_types.length
        ? member.event_types.filter(event => ALLOWED_EVENT_KEYS.has(event))
        : [...fallbackEvents]

    return {
        id: String(member.id || `member-${Date.now()}-${index}`),
        name,
        phone,
        role: String(member.role || '').trim(),
        enabled: member.enabled !== false,
        critical_only: member.critical_only === true,
        event_types: eventTypes,
    }
}

function simplifyRecipient(recipient: SectorNotificationRecipient, options: { keepEmptyMembers?: boolean } = {}): SectorNotificationRecipient {
    const fallbackEvents = getDefaultEventTypes(recipient.key)
    const members = (recipient.members || [])
        .map((member, index) => simplifyMember(member, index, fallbackEvents))
        .filter(member => options.keepEmptyMembers || member.name || member.phone)
    const primaryMember = members.find(member => member.enabled !== false && normalizeSectorPhone(member.phone))
        || members.find(member => normalizeSectorPhone(member.phone))
        || members[0]

    return {
        key: recipient.key,
        label: recipient.label,
        responsible_name: primaryMember?.name || recipient.responsible_name || '',
        phone: primaryMember?.phone || recipient.phone || '',
        enabled: recipient.enabled !== false,
        destination_type: 'phone',
        delivery_mode: 'all_sector',
        event_types: [...fallbackEvents],
        members,
        target_instance_id: '',
        whatsapp_instance_id: recipient.whatsapp_instance_id || '',
    }
}

function makeEmptyMember(sectorKey: string): SectorNotificationMember {
    return {
        id: `member-${Date.now()}`,
        name: '',
        phone: '',
        role: '',
        enabled: true,
        critical_only: false,
        event_types: [...getDefaultEventTypes(sectorKey)],
    }
}

function getLegacyMarketingConfigs(recipients: SectorNotificationRecipient[]): Record<string, string> {
    const marketing = recipients.find(recipient => recipient.key === 'marketing')
    if (!marketing) return {}

    return {
        property_review_sector_name: marketing.label,
        property_review_responsible_name: marketing.responsible_name,
        property_review_responsible_phone: marketing.phone,
        property_review_whatsapp_instance_id: marketing.whatsapp_instance_id || '',
    }
}

export default function InternalNotifierPanel() {
    const [configs, setConfigs] = useState<Record<string, string>>({})
    const [selectedSector, setSelectedSector] = useState('marketing')
    const [loading, setLoading] = useState(true)
    const [saveState, setSaveState] = useState<SaveState>({ status: 'idle', message: '' })
    const recipientsRef = useRef<SectorNotificationRecipient[]>([])

    const recipients = useMemo(
        () => getSectorNotificationRecipientsFromConfig(configs).map(recipient => simplifyRecipient(recipient, { keepEmptyMembers: true })),
        [configs]
    )
    recipientsRef.current = recipients

    const selectedRecipient = recipients.find(recipient => recipient.key === selectedSector)
        || recipients.find(recipient => recipient.key === 'marketing')
        || recipients[0]
    const totalPhones = recipients.reduce(
        (total, recipient) => total + (recipient.members || []).filter(member => member.enabled !== false && normalizeSectorPhone(member.phone)).length,
        0
    )
    const activeSectors = recipients.filter(recipient => recipient.enabled !== false).length

    useEffect(() => {
        let cancelled = false

        const loadConfigs = async () => {
            setLoading(true)
            try {
                const response = await fetch('/api/admin/configs', { cache: 'no-store' })
                const payload = await response.json().catch(() => ({}))
                if (!cancelled && payload?.success) {
                    setConfigs(payload.configs || {})
                }
            } catch (error) {
                if (!cancelled) {
                    setSaveState({ status: 'error', message: 'Nao foi possivel carregar os avisos internos.' })
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadConfigs()
        return () => {
            cancelled = true
        }
    }, [])

    const updateRecipient = (sectorKey: string, patch: Partial<SectorNotificationRecipient>) => {
        setSaveState({ status: 'idle', message: '' })
        setConfigs(current => {
            const currentRecipients = getSectorNotificationRecipientsFromConfig(current)
                .map(recipient => simplifyRecipient(recipient, { keepEmptyMembers: true }))
            const nextRecipients = currentRecipients.map(recipient =>
                recipient.key === sectorKey ? simplifyRecipient({ ...recipient, ...patch }, { keepEmptyMembers: true }) : recipient
            )
            return {
                ...current,
                [SECTOR_NOTIFICATION_CONFIG_KEY]: JSON.stringify(nextRecipients),
                ...getLegacyMarketingConfigs(nextRecipients),
            }
        })
    }

    const updateMember = (sectorKey: string, memberId: string, patch: Partial<SectorNotificationMember>) => {
        const recipient = recipients.find(item => item.key === sectorKey)
        if (!recipient) return

        const members = (recipient.members || []).map(member =>
            member.id === memberId ? { ...member, ...patch } : member
        )
        updateRecipient(sectorKey, { members })
    }

    const addMember = (sectorKey: string) => {
        const recipient = recipients.find(item => item.key === sectorKey)
        if (!recipient) return

        updateRecipient(sectorKey, {
            members: [...(recipient.members || []), makeEmptyMember(sectorKey)],
        })
    }

    const removeMember = (sectorKey: string, memberId: string) => {
        const recipient = recipients.find(item => item.key === sectorKey)
        if (!recipient) return

        updateRecipient(sectorKey, {
            members: (recipient.members || []).filter(member => member.id !== memberId),
        })
    }

    const toggleMemberEvent = (sectorKey: string, memberId: string, eventKey: string) => {
        const recipient = recipients.find(item => item.key === sectorKey)
        const member = recipient?.members?.find(item => item.id === memberId)
        if (!recipient || !member) return

        const events = new Set(member.event_types || getDefaultEventTypes(sectorKey))
        if (events.has(eventKey)) {
            events.delete(eventKey)
        } else {
            events.add(eventKey)
        }
        updateMember(sectorKey, memberId, { event_types: Array.from(events) })
    }

    const saveNotifierSettings = async () => {
        setSaveState({ status: 'saving', message: 'Salvando avisos internos...' })
        const nextRecipients = recipientsRef.current.map(recipient => simplifyRecipient(recipient))
        const configsToSave: Record<string, string> = {
            property_review_whatsapp_enabled: configs.property_review_whatsapp_enabled || 'true',
            property_review_message_template: configs.property_review_message_template || DEFAULT_PROPERTY_REVIEW_MESSAGE_TEMPLATE,
            [SECTOR_NOTIFICATION_CONFIG_KEY]: JSON.stringify(nextRecipients),
            ...getLegacyMarketingConfigs(nextRecipients),
        }

        try {
            const response = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: configsToSave }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.message || payload?.error || 'Nao foi possivel salvar os avisos.')
            }
            setConfigs(current => ({ ...current, ...configsToSave }))
            setSaveState({ status: 'success', message: 'Avisos internos salvos no agente.' })
        } catch (error: any) {
            setSaveState({ status: 'error', message: error?.message || 'Erro ao salvar avisos internos.' })
        }
    }

    return (
        <div className="agent-office-notifier-card">
            <div className="agent-office-prompt-head">
                <div>
                    <h3><MessageSquareText size={17} /> Central de avisos WhatsApp</h3>
                    <p>Cadastre quem recebe cada tipo de alerta. A Nina usa estas tags para rotear os avisos internos.</p>
                </div>
                <div className="agent-office-prompt-meta">
                    <span>{totalPhones} telefone{totalPhones === 1 ? '' : 's'}</span>
                    <span>{activeSectors} setores ativos</span>
                </div>
            </div>

            {loading ? (
                <div className="agent-office-loading-inline">
                    <Loader2 size={16} className="spin" />
                    Carregando central de avisos...
                </div>
            ) : (
                <>
                    <div className="agent-office-notifier-body">
                        <section className="agent-office-control-group">
                            <strong>Controle geral</strong>
                            <div className="agent-office-control-grid">
                                <label className="agent-office-control">
                                    <span>Avisos automaticos de cadastro</span>
                                    <select
                                        value={configs.property_review_whatsapp_enabled || 'true'}
                                        onChange={event => setConfigs(current => ({ ...current, property_review_whatsapp_enabled: event.target.value }))}
                                    >
                                        <option value="true">Ativado</option>
                                        <option value="false">Desativado</option>
                                    </select>
                                    <small>Controla o aviso quando um imovel entra em analise.</small>
                                </label>
                                <label className="agent-office-control">
                                    <span>Setor em edicao</span>
                                    <select
                                        value={selectedRecipient?.key || selectedSector}
                                        onChange={event => setSelectedSector(event.target.value)}
                                    >
                                        {recipients.map(recipient => (
                                            <option value={recipient.key} key={recipient.key}>{recipient.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="agent-office-control">
                                    <span>Status do setor</span>
                                    <select
                                        value={selectedRecipient?.enabled === false ? 'false' : 'true'}
                                        disabled={!selectedRecipient}
                                        onChange={event => selectedRecipient && updateRecipient(selectedRecipient.key, { enabled: event.target.value === 'true' })}
                                    >
                                        <option value="true">Ativo</option>
                                        <option value="false">Inativo</option>
                                    </select>
                                </label>
                            </div>
                        </section>

                        <section className="agent-office-control-group agent-office-notifier-sector-card">
                            <strong>Setores</strong>
                            <div className="sector-compact-summary">
                                {recipients.map(recipient => {
                                    const activeMembers = (recipient.members || []).filter(member => member.enabled !== false && normalizeSectorPhone(member.phone)).length
                                    return (
                                        <button
                                            type="button"
                                            className={`sector-summary-chip ${recipient.key === selectedRecipient?.key ? 'active' : ''}`}
                                            key={recipient.key}
                                            onClick={() => setSelectedSector(recipient.key)}
                                        >
                                            <span>{recipient.label}</span>
                                            <small>{activeMembers} telefone{activeMembers === 1 ? '' : 's'}</small>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        {selectedRecipient && (
                            <section className="agent-office-control-group agent-office-control-wide">
                                <div className="agent-office-notifier-section-head">
                                    <div>
                                        <strong>Telefones de {selectedRecipient.label}</strong>
                                        <p>Cadastre nome e telefone, depois marque nas tags quais avisos essa pessoa recebe.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="agent-office-legacy-link"
                                        onClick={() => addMember(selectedRecipient.key)}
                                    >
                                        <UserPlus size={14} /> Adicionar
                                    </button>
                                </div>

                                <div className="agent-office-notifier-members">
                                    {(selectedRecipient.members || []).length ? (
                                        (selectedRecipient.members || []).map((member, index) => (
                                            <div className="agent-office-notifier-member" key={member.id}>
                                                <div className="agent-office-notifier-member-fields">
                                                    <input
                                                        value={member.name}
                                                        onChange={event => updateMember(selectedRecipient.key, member.id, { name: event.target.value })}
                                                        placeholder={index === 0 ? 'Responsavel principal' : 'Nome'}
                                                    />
                                                    <input
                                                        type="tel"
                                                        inputMode="tel"
                                                        value={member.phone}
                                                        onChange={event => updateMember(selectedRecipient.key, member.id, { phone: event.target.value, enabled: true })}
                                                        placeholder="(47) 99999-9999"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="agent-office-notifier-remove"
                                                        onClick={() => removeMember(selectedRecipient.key, member.id)}
                                                        aria-label="Remover envolvido"
                                                        title="Remover envolvido"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                                <div>
                                                    <span className="agent-office-notifier-tag-label">O que recebe</span>
                                                    <div className="agent-office-notifier-tags">
                                                        {SECTOR_NOTIFICATION_EVENTS.map(event => {
                                                            const selectedEvents = member.event_types || getDefaultEventTypes(selectedRecipient.key)
                                                            const active = selectedEvents.includes(event.key)
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={`${member.id}-${event.key}`}
                                                                    className={active ? 'active' : ''}
                                                                    onClick={() => toggleMemberEvent(selectedRecipient.key, member.id, event.key)}
                                                                >
                                                                    {event.label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="sector-compact-hint">
                                            Nenhum telefone cadastrado neste setor. Clique em Adicionar para incluir quem deve receber os avisos.
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        <section className="agent-office-control-group agent-office-control-wide">
                            <strong>Modelo especifico de imovel em analise</strong>
                            <label className="agent-office-control agent-office-control-wide">
                                <span>Mensagem enviada quando um imovel entra em analise</span>
                                <textarea
                                    rows={7}
                                    value={configs.property_review_message_template || DEFAULT_PROPERTY_REVIEW_MESSAGE_TEMPLATE}
                                    onChange={event => setConfigs(current => ({ ...current, property_review_message_template: event.target.value }))}
                                    placeholder="Use variaveis: {setor}, {responsavel}, {titulo}, {cidade}, {valor}, {link}"
                                />
                                <small>Variaveis: {'{setor}'}, {'{responsavel}'}, {'{titulo}'}, {'{cidade}'}, {'{valor}'}, {'{link}'}.</small>
                            </label>
                        </section>
                    </div>

                    <div className="agent-office-actions agent-office-notifier-actions">
                        <button
                            type="button"
                            className="agent-office-save"
                            onClick={saveNotifierSettings}
                            disabled={saveState.status === 'saving'}
                        >
                            {saveState.status === 'saving' ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                            Salvar avisos
                        </button>
                        {saveState.message && (
                            <span className={`agent-office-save-message ${saveState.status}`}>
                                {saveState.message}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
