'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
    Activity, Bot, CheckCircle2, Clock, FileText, Flag, GitBranch, Hourglass, Image as ImageIcon,
    Link2, ListChecks, Loader2, MapPin, MessageSquare, Mic, MousePointer2, Plus, Power,
    Save, Smartphone, Trash2, Users, Video, Vote, Zap
} from 'lucide-react'

type Broker = { id: string; name: string | null; phone?: string | null; is_active?: boolean }
type Instance = { id: string; instance_name: string; phone_number?: string | null; status: string; broker_id?: string | null }
type WorkflowRun = {
    id: string
    workflow_id: string | null
    status: string
    lead_phone: string | null
    lead_name: string | null
    created_at: string
    completed_at: string | null
    error_message?: string | null
}
type WorkflowEvent = {
    id: string
    run_id: string | null
    workflow_id: string | null
    lead_phone: string | null
    event_type: string
    node_id: string | null
    status: string | null
    message: string | null
    metadata: Record<string, any> | null
    created_at: string
}
type Workflow = {
    id: string
    name: string
    description: string | null
    trigger_type: string
    broker_id: string | null
    instance_id: string | null
    is_active: boolean
    wait_for_online: boolean
    preferred_send_time: string
    nodes: any[]
    edges?: any[]
    metadata: Record<string, any>
    created_at: string
}
type WorkflowStep = {
    id: string
    wait_mode?: 'relative' | 'datetime'
    delay_minutes: number
    wait_until?: string
    action_type?: WorkflowActionType
    action_payload?: Record<string, any>
    message_template: string
    stop_if_replied: boolean
}
type ElevenLabsVoice = { voice_id: string; name: string; category: string; preview_url?: string | null }
type NodePosition = { x: number; y: number }
type VisualNodeType = 'trigger' | 'wait' | 'message' | 'end'
type WorkflowActionType = 'wait_only' | 'text' | 'url_buttons' | 'reply_buttons' | 'list' | 'poll' | 'audio_tts' | 'image' | 'video' | 'document' | 'location_request' | 'contact' | 'carousel'
type VisualNode = {
    id: string
    type: VisualNodeType
    label: string
    subtitle: string
    stepIndex?: number
    position: NodePosition
}

const MB = 1024 * 1024
const WORKFLOW_MEDIA_LIMITS = {
    image: 5 * MB,
    video: 16 * MB,
    document: 100 * MB,
}

const TRIGGERS = [
    { value: 'lead_created', label: 'Lead criado' },
    { value: 'lead_no_reply', label: 'Lead sem resposta' },
    { value: 'lead_qualified', label: 'Lead qualificado' },
    { value: 'appointment_pending', label: 'Visita pendente' },
    { value: 'manual', label: 'Manual' },
]

const SEND_TIMES = [
    { value: 'same_time', label: 'Mesmo horario do primeiro contato' },
    { value: 'business_hours', label: 'Horario comercial' },
    { value: 'anytime', label: 'Qualquer horario' },
]

const ACTION_TYPES: Array<{ value: WorkflowActionType; label: string; hint: string }> = [
    { value: 'wait_only', label: 'Espera', hint: 'Aguarda um tempo ou uma data antes do proximo passo, sem enviar mensagem.' },
    { value: 'text', label: 'Texto', hint: 'Mensagem comum de WhatsApp.' },
    { value: 'url_buttons', label: 'Botoes URL', hint: 'Botoes que abrem links externos.' },
    { value: 'reply_buttons', label: 'Botoes rapidos', hint: 'Ate 3 respostas rapidas para o lead tocar.' },
    { value: 'list', label: 'Lista', hint: 'Menu com varias opcoes organizadas.' },
    { value: 'poll', label: 'Enquete', hint: 'Pergunta com opcoes de voto.' },
    { value: 'audio_tts', label: 'Audio IA', hint: 'Gera audio automaticamente com voz ElevenLabs.' },
    { value: 'image', label: 'Imagem', hint: 'Foto com legenda opcional.' },
    { value: 'video', label: 'Video', hint: 'Video MP4 com legenda opcional.' },
    { value: 'document', label: 'Documento', hint: 'PDF ou arquivo com legenda opcional.' },
    { value: 'location_request', label: 'Pedir localizacao', hint: 'Botao nativo para o lead enviar localizacao.' },
    { value: 'contact', label: 'Contato', hint: 'Envia um contato salvo para o lead.' },
    { value: 'carousel', label: 'Carrossel', hint: 'Cards com imagem e botoes. Modo avancado via JSON.' },
]

const emptyForm = {
    id: '',
    name: '',
    description: '',
    trigger_type: 'lead_created',
    broker_id: '',
    instance_id: '',
    delay_minutes: 15,
    message_template: 'Oi {nome_lead}, passando para saber se posso te ajudar com o imovel que voce viu.',
    is_active: true,
    wait_for_online: false,
    online_wait_max_minutes: 60,
    online_check_interval_minutes: 5,
    preferred_send_time: 'same_time',
    steps: [] as WorkflowStep[],
}

function defaultNodePosition(nodeId: string, stepIndex = 0): NodePosition {
    if (nodeId === 'trigger') return { x: 28, y: 118 }
    if (nodeId === 'end') return { x: 880, y: 118 }
    if (nodeId.startsWith('wait_')) return { x: 250 + stepIndex * 310, y: 76 }
    return { x: 250 + stepIndex * 310, y: 184 }
}

function toDateTimeLocalValue(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDateTimeLocalValue(value: string) {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function stepWaitLabel(step: WorkflowStep) {
    if (step.wait_mode === 'datetime' && step.wait_until) {
        const date = new Date(step.wait_until)
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            })
        }
    }
    return `${step.delay_minutes || 0} min`
}

function actionTypeLabel(type?: WorkflowActionType) {
    return ACTION_TYPES.find(action => action.value === (type || 'text'))?.label || 'Texto'
}

function defaultPayloadForAction(type: WorkflowActionType): Record<string, any> {
    if (type === 'wait_only') return {}
    if (type === 'url_buttons') return { url_buttons_text: 'Ver imóvel=>https://seu-link.com', footer_text: '' }
    if (type === 'reply_buttons') return { reply_options_text: 'Tenho interesse\nQuero visitar\nMe chama depois', footer_text: '' }
    if (type === 'list') return { list_button: 'Ver opcoes', list_choices_text: '[Imoveis]\nFrente mar|frente_mar|Opcoes frente mar\nCoberturas|coberturas|Coberturas selecionadas', footer_text: '' }
    if (type === 'poll') return { poll_options_text: 'Moradia\nInvestimento\nOs dois', poll_multi: false }
    if (type === 'audio_tts') return { audio_text: 'Oi {nome_lead}, passando rapidinho para saber se posso te ajudar.', voice_id: '', ptt: true }
    if (type === 'image') return { image_url: '', media_button_text: '', media_url_buttons_text: '' }
    if (type === 'video') return { video_url: '', thumbnail_url: '', media_button_text: '', media_url_buttons_text: '' }
    if (type === 'document') return { document_url: '', file_name: '', media_button_text: '', media_url_buttons_text: '' }
    if (type === 'contact') return { contact_name: '', contact_phone: '' }
    if (type === 'carousel') return {
        carousel_cards_json: '[{"text":"Imovel destaque","image":"https://site.com/foto.jpg","buttons":[{"id":"https://site.com/imovel","text":"Ver imovel","type":"URL"}]}]',
    }
    return {}
}

function actionIcon(type?: WorkflowActionType) {
    if (type === 'wait_only') return <Hourglass size={16} />
    if (type === 'url_buttons') return <Link2 size={16} />
    if (type === 'reply_buttons') return <ListChecks size={16} />
    if (type === 'list') return <ListChecks size={16} />
    if (type === 'poll') return <Vote size={16} />
    if (type === 'audio_tts') return <Mic size={16} />
    if (type === 'image') return <ImageIcon size={16} />
    if (type === 'video') return <Video size={16} />
    if (type === 'document') return <FileText size={16} />
    if (type === 'location_request') return <MapPin size={16} />
    if (type === 'contact') return <Users size={16} />
    if (type === 'carousel') return <ImageIcon size={16} />
    return <Bot size={16} />
}

function stepHasContent(step: WorkflowStep) {
    const payload = step.action_payload || {}
    const text = String(step.message_template || '').trim()
    if (step.action_type === 'wait_only') return true
    if ((step.action_type || 'text') === 'text') return !!text
    if (step.action_type === 'url_buttons') return !!String(payload.url_buttons_text || '').trim()
    if (step.action_type === 'reply_buttons') return !!String(payload.reply_options_text || '').trim()
    if (step.action_type === 'list') return !!String(payload.list_choices_text || '').trim()
    if (step.action_type === 'poll') return String(payload.poll_options_text || '').split(/\r?\n/).filter(Boolean).length >= 2
    if (step.action_type === 'audio_tts') return !!String(payload.audio_text || step.message_template || '').trim()
    if (step.action_type === 'image') return !!String(payload.image_url || '').trim()
    if (step.action_type === 'video') return !!String(payload.video_url || '').trim()
    if (step.action_type === 'document') return !!String(payload.document_url || '').trim()
    if (step.action_type === 'location_request') return !!text
    if (step.action_type === 'contact') return !!String(payload.contact_name || '').trim() && !!String(payload.contact_phone || '').trim()
    if (step.action_type === 'carousel') return !!String(payload.carousel_cards_json || '').trim()
    return !!text
}

function updateStepPayload(step: WorkflowStep, patch: Record<string, any>) {
    return { ...(step.action_payload || {}), ...patch }
}

function formatFileSize(bytes: number) {
    if (!bytes) return '0MB'
    return `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)}MB`
}

function validateWorkflowMediaFile(file: File, kind: keyof typeof WORKFLOW_MEDIA_LIMITS) {
    const maxSize = WORKFLOW_MEDIA_LIMITS[kind]
    if (file.size > maxSize) {
        return `${kind === 'image' ? 'Imagem' : kind === 'video' ? 'Video' : 'Documento'} acima do limite. Maximo permitido: ${formatFileSize(maxSize)}. Arquivo atual: ${formatFileSize(file.size)}.`
    }
    if (kind === 'image' && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        return 'Formato de imagem nao suportado. Use JPG, PNG, WEBP ou GIF.'
    }
    if (kind === 'video' && !['video/mp4', 'video/webm'].includes(file.type)) {
        return 'Formato de video nao suportado. Use MP4 sempre que possivel.'
    }
    return ''
}

function buildVisualNodes(form: typeof emptyForm, positions: Record<string, NodePosition>): VisualNode[] {
    const nodes: VisualNode[] = [{
        id: 'trigger',
        type: 'trigger',
        label: TRIGGERS.find(trigger => trigger.value === form.trigger_type)?.label || 'Entrada',
        subtitle: 'Dispara o workflow',
        position: positions.trigger || defaultNodePosition('trigger'),
    }]

    form.steps.forEach((step, index) => {
        const waitId = `wait_${index + 1}`
        const messageId = `message_${index + 1}`
        const isWaitOnly = step.action_type === 'wait_only'
        nodes.push({
            id: waitId,
            type: 'wait',
            label: stepWaitLabel(step),
            subtitle: isWaitOnly ? 'Espera sem envio' : 'Tempo antes do envio',
            stepIndex: index,
            position: positions[waitId] || defaultNodePosition(waitId, index),
        })
        if (isWaitOnly) return
        nodes.push({
            id: messageId,
            type: 'message',
            label: `${actionTypeLabel(step.action_type)} ${index + 1}`,
            subtitle: actionTypeLabel(step.action_type),
            stepIndex: index,
            position: positions[messageId] || defaultNodePosition(messageId, index),
        })
    })

    const lastX = Math.max(880, 250 + form.steps.length * 310)
    nodes.push({
        id: 'end',
        type: 'end',
        label: 'Fim',
        subtitle: 'Encerra ou aguarda novo gatilho',
        position: positions.end || { x: lastX, y: 118 },
    })

    return nodes
}

function workflowNodesFromForm(form: typeof emptyForm, positions: Record<string, NodePosition>) {
    const nodes: any[] = [{
        id: 'trigger',
        type: 'trigger',
        label: 'Entrada do lead',
        position: positions.trigger || defaultNodePosition('trigger'),
        data: { trigger_type: form.trigger_type },
    }]

    form.steps.forEach((step, index) => {
        const waitId = `wait_${index + 1}`
        const messageId = `message_${index + 1}`
        const isWaitOnly = step.action_type === 'wait_only'
        nodes.push({
            id: waitId,
            type: 'wait',
            label: `Aguardar ${index + 1}`,
            position: positions[waitId] || defaultNodePosition(waitId, index),
            data: {
                wait_mode: step.wait_mode || 'relative',
                delay_minutes: step.delay_minutes,
                wait_until: step.wait_until || null,
                stop_if_replied: step.stop_if_replied,
                step_id: step.id,
                action_type: step.action_type || 'text',
            },
        })
        if (isWaitOnly) return
        nodes.push({
            id: messageId,
            type: 'agent_message',
            label: `Mensagem ${index + 1}`,
            position: positions[messageId] || defaultNodePosition(messageId, index),
            data: {
                message_template: step.message_template,
                action_type: step.action_type || 'text',
                action_payload: step.action_payload || {},
                stop_if_replied: step.stop_if_replied,
                step_id: step.id,
            },
        })
    })

    nodes.push({
        id: 'end',
        type: 'end',
        label: 'Fim do workflow',
        position: positions.end || defaultNodePosition('end'),
        data: {},
    })

    return nodes
}

function workflowEdgesFromSteps(steps: WorkflowStep[]) {
    const edges: any[] = []
    let previous = 'trigger'
    for (let index = 0; index < steps.length; index++) {
        const waitId = `wait_${index + 1}`
        const messageId = `message_${index + 1}`
        edges.push({ id: `${previous}-${waitId}`, source: previous, target: waitId })
        if (steps[index]?.action_type === 'wait_only') {
            previous = waitId
            continue
        }
        edges.push({ id: `${waitId}-${messageId}`, source: waitId, target: messageId })
        previous = messageId
    }
    edges.push({ id: `${previous}-end`, source: previous, target: 'end' })
    return edges
}

function positionsFromWorkflow(workflow: Workflow): Record<string, NodePosition> {
    const positions: Record<string, NodePosition> = {}
    if (!Array.isArray(workflow.nodes)) return positions
    workflow.nodes.forEach((node) => {
        if (!node?.id || !node?.position) return
        positions[String(node.id)] = {
            x: Number(node.position.x || 0),
            y: Number(node.position.y || 0),
        }
    })
    return positions
}

function extractSteps(workflow: Workflow): WorkflowStep[] {
    const metadataSteps = Array.isArray(workflow.metadata?.steps) ? workflow.metadata.steps : []
    if (metadataSteps.length > 0) {
        return metadataSteps.map((step: any, index: number) => ({
            id: String(step?.id || `step_${index + 1}`),
            wait_mode: (step?.wait_mode === 'datetime' ? 'datetime' : 'relative') as WorkflowStep['wait_mode'],
            delay_minutes: Number(step?.delay_minutes || 0),
            wait_until: step?.wait_until ? String(step.wait_until) : '',
            action_type: (ACTION_TYPES.some(action => action.value === step?.action_type) ? step.action_type : 'text') as WorkflowActionType,
            action_payload: step?.action_payload && typeof step.action_payload === 'object' ? step.action_payload : {},
            message_template: String(step?.message_template || ''),
            stop_if_replied: step?.stop_if_replied !== false,
        })).filter(stepHasContent)
    }

    const waitNodes = Array.isArray(workflow.nodes)
        ? workflow.nodes.filter((node) => node?.type === 'wait').sort((a, b) => Number(a?.position?.x || 0) - Number(b?.position?.x || 0))
        : []
    const messageNodes = Array.isArray(workflow.nodes)
        ? workflow.nodes.filter((node) => node?.type === 'agent_message' || node?.type === 'message').sort((a, b) => Number(a?.position?.x || 0) - Number(b?.position?.x || 0))
        : []

    const steps = messageNodes.map((messageNode, index) => ({
        id: String(messageNode?.data?.step_id || `step_${index + 1}`),
        wait_mode: (waitNodes[index]?.data?.wait_mode === 'datetime' ? 'datetime' : 'relative') as WorkflowStep['wait_mode'],
        delay_minutes: Number(waitNodes[index]?.data?.delay_minutes || 0),
        wait_until: waitNodes[index]?.data?.wait_until ? String(waitNodes[index].data.wait_until) : '',
        action_type: (ACTION_TYPES.some(action => action.value === messageNode?.data?.action_type) ? messageNode.data.action_type : 'text') as WorkflowActionType,
        action_payload: messageNode?.data?.action_payload && typeof messageNode.data.action_payload === 'object' ? messageNode.data.action_payload : {},
        message_template: String(messageNode?.data?.message_template || ''),
        stop_if_replied: messageNode?.data?.stop_if_replied !== false,
    })).filter(stepHasContent)

    return steps
}

function extractTemplate(workflow: Workflow) {
    const firstStep = extractSteps(workflow)[0]
    if (firstStep?.message_template) return firstStep.message_template
    const messageNode = Array.isArray(workflow.nodes)
        ? workflow.nodes.find((node) => node?.type === 'agent_message' || node?.type === 'message')
        : null
    return String(messageNode?.data?.message_template || workflow.metadata?.message_template || emptyForm.message_template || '')
}

function extractDelay(workflow: Workflow) {
    const firstStep = extractSteps(workflow)[0]
    if (firstStep) return firstStep.delay_minutes
    const waitNodes = Array.isArray(workflow.nodes)
        ? workflow.nodes.filter((node) => node?.type === 'wait')
        : []
    const fromNodes = waitNodes.reduce((sum, node) => sum + Number(node?.data?.delay_minutes || 0), 0)
    return fromNodes || Number(workflow.metadata?.delay_minutes || 0)
}

function extractTotalDelay(workflow: Workflow) {
    const steps = extractSteps(workflow)
    if (steps.length > 0) {
        return steps.reduce((sum, step) => sum + Number(step.delay_minutes || 0), 0)
    }
    return extractDelay(workflow)
}

function eventLabel(eventType: string) {
    const labels: Record<string, string> = {
        workflow_started: 'Iniciado',
        workflow_waiting: 'Aguardando',
        waiting_for_lead_online: 'Esperando online',
        lead_online_detected: 'Lead online',
        lead_online_wait_timeout: 'Online timeout',
        message_sent: 'Mensagem enviada',
        workflow_stopped: 'Parado',
        workflow_completed: 'Concluido',
        workflow_failed: 'Falhou',
    }
    return labels[eventType] || eventType
}

export default function AutomationPage() {
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [instances, setInstances] = useState<Instance[]>([])
    const [runs, setRuns] = useState<WorkflowRun[]>([])
    const [events, setEvents] = useState<WorkflowEvent[]>([])
    const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [running, setRunning] = useState(false)
    const [form, setForm] = useState({ ...emptyForm })
    const [manualRun, setManualRun] = useState({ workflow_id: '', phone: '', name: '' })
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [uploadingMedia, setUploadingMedia] = useState<Record<string, boolean>>({})
    const [selectedNodeId, setSelectedNodeId] = useState('trigger')
    const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({})
    const [draggingNode, setDraggingNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
    const canvasRef = useRef<HTMLDivElement | null>(null)

    const brokerById = useMemo(() => new Map(brokers.map((broker) => [broker.id, broker])), [brokers])
    const instanceById = useMemo(() => new Map(instances.map((instance) => [instance.id, instance])), [instances])
    const instanceByBrokerId = useMemo(
        () => new Map(instances
            .filter(instance => instance.broker_id && instance.status === 'connected')
            .map(instance => [instance.broker_id as string, instance])),
        [instances]
    )
    const availableAgentBrokers = useMemo(
        () => brokers.filter(broker => instanceByBrokerId.has(broker.id)),
        [brokers, instanceByBrokerId]
    )
    const selectedBrokerInstance = form.broker_id ? instanceByBrokerId.get(form.broker_id) : null
    const totalDelayMinutes = useMemo(
        () => form.steps.reduce((sum, item) => sum + Number(item.delay_minutes || 0), 0),
        [form.steps]
    )
    const visualNodes = useMemo(() => buildVisualNodes(form, nodePositions), [form, nodePositions])
    const selectedNode = visualNodes.find(node => node.id === selectedNodeId) || visualNodes[0]

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/automation/workflows')
            const data = await res.json()
            if (!res.ok || data?.success === false) throw new Error(data?.message || 'Erro ao carregar workflows.')
            setWorkflows(data.workflows || [])
            setBrokers(data.brokers || [])
            setInstances(data.instances || [])
            setRuns(data.recent_runs || [])
            setEvents(data.recent_events || [])
            fetch('/api/admin/elevenlabs-voices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
                .then(res => res.ok ? res.json() : null)
                .then(json => {
                    if (json?.success && Array.isArray(json.voices)) setElevenLabsVoices(json.voices)
                })
                .catch(() => { })
        } catch (err: any) {
            setFeedback({ type: 'error', text: err.message || 'Erro ao carregar automacoes.' })
        } finally {
            setLoading(false)
        }
    }

    function editWorkflow(workflow: Workflow) {
        const steps = extractSteps(workflow)
        setForm({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description || '',
            trigger_type: workflow.trigger_type || 'lead_created',
            broker_id: workflow.broker_id || '',
            instance_id: workflow.instance_id || '',
            delay_minutes: extractDelay(workflow) || 15,
            message_template: extractTemplate(workflow) || emptyForm.message_template,
            is_active: workflow.is_active !== false,
            wait_for_online: workflow.wait_for_online === true,
            online_wait_max_minutes: Number(workflow.metadata?.online_wait_max_minutes || 60),
            online_check_interval_minutes: Number(workflow.metadata?.online_check_interval_minutes || 5),
            preferred_send_time: workflow.preferred_send_time || 'same_time',
            steps,
        })
        setNodePositions(positionsFromWorkflow(workflow))
        setSelectedNodeId(steps.length ? steps[0]?.action_type === 'wait_only' ? 'wait_1' : 'message_1' : 'trigger')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    async function saveWorkflow() {
        if (!form.steps.some(stepHasContent)) {
            setFeedback({ type: 'error', text: 'Adicione pelo menos um bloco de envio com conteudo antes de salvar.' })
            return
        }
        setSaving(true)
        setFeedback(null)
        try {
            const method = form.id ? 'PUT' : 'POST'
            const res = await fetch('/api/admin/automation/workflows', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    broker_id: form.broker_id || null,
                    instance_id: null,
                    delay_minutes: form.steps[0]?.delay_minutes || 0,
                    message_template: form.steps[0]?.message_template || '',
                    nodes: workflowNodesFromForm(form, nodePositions),
                    edges: workflowEdgesFromSteps(form.steps),
                    metadata: {
                        online_wait_max_minutes: form.online_wait_max_minutes,
                        online_check_interval_minutes: form.online_check_interval_minutes,
                        visual_builder: true,
                    },
                })
            })
            const data = await res.json()
            if (!res.ok || data?.success === false) throw new Error(data?.message || 'Erro ao salvar workflow.')
            setFeedback({ type: 'success', text: form.id ? 'Workflow atualizado.' : 'Workflow criado.' })
            setForm({ ...emptyForm })
            await loadData()
        } catch (err: any) {
            setFeedback({ type: 'error', text: err.message || 'Erro ao salvar workflow.' })
        } finally {
            setSaving(false)
        }
    }

    async function deleteWorkflow(id: string) {
        if (!confirm('Excluir este workflow?')) return
        try {
            const res = await fetch(`/api/admin/automation/workflows?id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok || data?.success === false) throw new Error(data?.message || 'Erro ao excluir workflow.')
            setFeedback({ type: 'success', text: 'Workflow excluido.' })
            await loadData()
        } catch (err: any) {
            setFeedback({ type: 'error', text: err.message || 'Erro ao excluir workflow.' })
        }
    }

    async function toggleWorkflow(workflow: Workflow) {
        const template = extractTemplate(workflow) || emptyForm.message_template
        const delay = extractDelay(workflow) || 15
        const steps = extractSteps(workflow)
            const res = await fetch('/api/admin/automation/workflows', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                id: workflow.id,
                name: workflow.name,
                description: workflow.description || '',
                trigger_type: workflow.trigger_type,
                broker_id: workflow.broker_id,
                instance_id: null,
                delay_minutes: delay,
                message_template: template,
                steps,
                is_active: !workflow.is_active,
                wait_for_online: workflow.wait_for_online,
                preferred_send_time: workflow.preferred_send_time,
                nodes: workflow.nodes || [],
                edges: workflow.edges || [],
                metadata: workflow.metadata || {},
            })
        })
        const data = await res.json()
        if (!res.ok || data?.success === false) {
            setFeedback({ type: 'error', text: data?.message || 'Erro ao alterar status.' })
        }
        await loadData()
    }

    function updateStep(index: number, patch: Partial<WorkflowStep>) {
        setForm(prev => ({
            ...prev,
            steps: prev.steps.map((step, stepIndex) =>
                stepIndex === index ? { ...step, ...patch } : step
            ),
        }))
    }

    async function uploadWorkflowMedia(stepIndex: number, field: string, file: File | null, folder: string, kind: keyof typeof WORKFLOW_MEDIA_LIMITS) {
        if (!file) return
        const validationError = validateWorkflowMediaFile(file, kind)
        if (validationError) {
            setFeedback({ type: 'error', text: validationError })
            return
        }
        const uploadKey = `${stepIndex}_${field}`
        setUploadingMedia(prev => ({ ...prev, [uploadKey]: true }))
        setFeedback(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', `workflow-media/${folder}`)
            formData.append('kind', kind)

            const res = await fetch('/api/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok || !data?.url) throw new Error(data?.error || data?.details || 'Erro ao subir midia.')

            setForm(prev => ({
                ...prev,
                steps: prev.steps.map((step, index) => index === stepIndex
                    ? { ...step, action_payload: { ...(step.action_payload || {}), [field]: data.url } }
                    : step
                ),
            }))
            setFeedback({ type: 'success', text: 'Midia enviada para o R2 e vinculada ao bloco.' })
        } catch (err: any) {
            setFeedback({ type: 'error', text: err.message || 'Erro ao subir midia.' })
        } finally {
            setUploadingMedia(prev => ({ ...prev, [uploadKey]: false }))
        }
    }

    function defaultMessageForAction(actionType: WorkflowActionType, index: number) {
        if (actionType === 'wait_only') return ''
        if (actionType === 'audio_tts') return ''
        if (actionType === 'image') return 'Separei essa imagem para voce.'
        if (actionType === 'video') return 'Separei esse video para voce.'
        if (actionType === 'url_buttons') return 'Clique abaixo para ver com mais detalhes.'
        if (actionType === 'reply_buttons') return 'Qual opcao faz mais sentido agora?'
        if (actionType === 'list') return 'Separei algumas opcoes para voce.'
        if (actionType === 'poll') return 'Me ajuda com uma escolha rapida?'
        if (actionType === 'document') return 'Segue o material que comentei.'
        if (actionType === 'location_request') return 'Pode me enviar sua localizacao por aqui? Assim eu consigo te indicar as opcoes mais proximas.'
        if (actionType === 'contact') return ''
        if (actionType === 'carousel') return 'Separei algumas opcoes para voce.'
        return index === 1
            ? emptyForm.message_template
            : 'Oi {nome_lead}, voltei por aqui para saber se ainda faz sentido conversarmos sobre esse imovel.'
    }

    function addStep(actionType: WorkflowActionType = 'text') {
        const currentLength = form.steps.length
        setForm(prev => {
            const nextIndex = prev.steps.length + 1
            const previousIsWaitOnly = prev.steps[nextIndex - 2]?.action_type === 'wait_only'
            const newStep: WorkflowStep = {
                id: `step_${nextIndex}`,
                wait_mode: 'relative',
                delay_minutes: actionType === 'wait_only' ? 15 : previousIsWaitOnly ? 0 : nextIndex === 1 ? 15 : 1440,
                wait_until: '',
                action_type: actionType,
                action_payload: defaultPayloadForAction(actionType),
                message_template: defaultMessageForAction(actionType, nextIndex),
                stop_if_replied: true,
            }
            return {
                ...prev,
                steps: [...prev.steps, newStep].slice(0, 8),
            }
        })
        const nextNodeIndex = Math.min(currentLength + 1, 8)
        setSelectedNodeId(actionType === 'wait_only' ? `wait_${nextNodeIndex}` : `message_${nextNodeIndex}`)
    }

    function removeStep(index: number) {
        setForm(prev => {
            return {
                ...prev,
                steps: prev.steps.filter((_step, stepIndex) => stepIndex !== index),
            }
        })
        setSelectedNodeId('trigger')
        setNodePositions(prev => {
            const next = { ...prev }
            delete next[`wait_${index + 1}`]
            delete next[`message_${index + 1}`]
            return next
        })
    }

    function resetBuilder() {
        setForm({ ...emptyForm })
        setNodePositions({})
        setSelectedNodeId('trigger')
    }

    function clearFlowSteps() {
        setForm(prev => ({ ...prev, id: '', steps: [] }))
        setNodePositions({})
        setSelectedNodeId('trigger')
    }

    function startNodeDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
        const canvasRect = canvasRef.current?.getBoundingClientRect()
        const nodeRect = event.currentTarget.getBoundingClientRect()
        if (!canvasRect) return
        setSelectedNodeId(id)
        setDraggingNode({
            id,
            offsetX: event.clientX - nodeRect.left,
            offsetY: event.clientY - nodeRect.top,
        })
    }

    function moveNode(event: PointerEvent<HTMLDivElement>) {
        if (!draggingNode || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const maxX = Math.max(20, rect.width - 180)
        const maxY = Math.max(20, rect.height - 96)
        const x = Math.min(maxX, Math.max(16, event.clientX - rect.left - draggingNode.offsetX))
        const y = Math.min(maxY, Math.max(16, event.clientY - rect.top - draggingNode.offsetY))
        setNodePositions(prev => ({ ...prev, [draggingNode.id]: { x, y } }))
    }

    function nodeIcon(type: VisualNodeType) {
        if (type === 'trigger') return <Users size={16} />
        if (type === 'wait') return <Clock size={16} />
        if (type === 'message') return <Bot size={16} />
        return <Flag size={16} />
    }

    async function runWorkflowManually() {
        if (!manualRun.workflow_id || !manualRun.phone) {
            setFeedback({ type: 'error', text: 'Escolha um workflow e informe o telefone.' })
            return
        }
        setRunning(true)
        setFeedback(null)
        try {
            const res = await fetch('/api/admin/automation/workflows/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manualRun),
            })
            const data = await res.json()
            if (!res.ok || data?.success === false) throw new Error(data?.message || 'Erro ao disparar workflow.')
            setFeedback({ type: 'success', text: data.message || 'Workflow enviado para execucao.' })
            setManualRun(prev => ({ ...prev, phone: '', name: '' }))
            setTimeout(loadData, 1500)
        } catch (err: any) {
            setFeedback({ type: 'error', text: err.message || 'Erro ao disparar workflow.' })
        } finally {
            setRunning(false)
        }
    }

    if (loading) {
        return <div style={{ padding: 40, color: 'var(--text-muted)' }}><Loader2 className="spin" /> Carregando automacoes...</div>
    }

    return (
        <div className="automation-page">
            <div className="admin-header">
                <div>
                    <h1><GitBranch size={26} /> Workflows de Atendimento</h1>
                    <p>Base para follow-up, resgate de leads e automacoes por agente IA.</p>
                </div>
            </div>

            {feedback && (
                <div className={`automation-feedback ${feedback.type}`}>
                    {feedback.text}
                </div>
            )}

            <section className="chart-card workflow-builder" key={form.steps.length === 0 && !form.id ? 'empty-builder' : 'active-builder'}>
                <div className="workflow-title">
                    <Zap size={20} />
                    <div>
                        <h2>{form.id ? 'Editar workflow' : 'Novo workflow'}</h2>
                        <p>Fase 4: sequencia de follow-up com varios passos e parada automatica se o lead responder.</p>
                    </div>
                </div>

                <div className="workflow-form-grid">
                    <label>
                        Nome
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Resgate 15 minutos" />
                    </label>
                    <label>
                        Gatilho
                        <select value={form.trigger_type} onChange={e => setForm(p => ({ ...p, trigger_type: e.target.value }))}>
                            {TRIGGERS.map(trigger => <option value={trigger.value} key={trigger.value}>{trigger.label}</option>)}
                        </select>
                    </label>
                    <label>
                        Agente IA
                        <select value={form.broker_id} onChange={e => setForm(p => ({ ...p, broker_id: e.target.value }))}>
                            <option value="">Escolher automaticamente</option>
                            {availableAgentBrokers.map(broker => <option value={broker.id} key={broker.id}>{broker.name || 'Agente sem nome'}</option>)}
                        </select>
                        <span>
                            {form.broker_id
                                ? selectedBrokerInstance
                                    ? `WhatsApp vinculado: ${selectedBrokerInstance.phone_number || selectedBrokerInstance.instance_name}`
                                    : 'Este agente nao possui WhatsApp conectado.'
                                : 'O sistema escolhe um agente com WhatsApp conectado.'}
                        </span>
                    </label>
                    <label>
                        Horario
                        <select value={form.preferred_send_time} onChange={e => setForm(p => ({ ...p, preferred_send_time: e.target.value }))}>
                            {SEND_TIMES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                </div>

                <div className="workflow-visual-builder">
                    <aside className="workflow-block-palette" aria-label="Ferramentas disponiveis">
                        <strong>Ferramentas</strong>
                        <button type="button" onClick={() => setSelectedNodeId('trigger')}>
                            <Users size={15} />
                            Entrada
                        </button>
                        {ACTION_TYPES.map(action => (
                            <button
                                type="button"
                                key={action.value}
                                onClick={() => addStep(action.value)}
                                disabled={form.steps.length >= 8}
                                title={action.hint}
                            >
                                {actionIcon(action.value)}
                                {action.label}
                            </button>
                        ))}
                        <button type="button" onClick={() => setSelectedNodeId('end')}>
                            <Flag size={15} />
                            Fim
                        </button>
                        <button type="button" onClick={clearFlowSteps}>
                            <Trash2 size={15} />
                            Limpar fluxo
                        </button>
                        <span>Arraste os blocos no quadro e ajuste o conteudo no painel lateral.</span>
                    </aside>

                    <div
                        className="workflow-canvas"
                        ref={canvasRef}
                        onPointerMove={moveNode}
                        onPointerUp={() => setDraggingNode(null)}
                        onPointerLeave={() => setDraggingNode(null)}
                    >
                        <div className="workflow-canvas-grid" />
                        <svg className="workflow-lines" viewBox="0 0 1120 360" preserveAspectRatio="none" aria-hidden="true">
                            {visualNodes.slice(0, -1).map((node, index) => {
                                const next = visualNodes[index + 1]
                                const x1 = node.position.x + 156
                                const y1 = node.position.y + 38
                                const x2 = next.position.x + 12
                                const y2 = next.position.y + 38
                                const mid = (x1 + x2) / 2
                                return (
                                    <path
                                        key={`${node.id}-${next.id}`}
                                        d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                                    />
                                )
                            })}
                        </svg>
                        {visualNodes.map(node => (
                            <button
                                type="button"
                                key={node.id}
                                className={`workflow-node ${node.type} ${selectedNodeId === node.id ? 'selected' : ''}`}
                                style={{ left: node.position.x, top: node.position.y }}
                                onPointerDown={event => startNodeDrag(event, node.id)}
                                onClick={() => setSelectedNodeId(node.id)}
                            >
                                <span className="workflow-node-icon">
                                    {node.type === 'message' && typeof node.stepIndex === 'number'
                                        ? actionIcon(form.steps[node.stepIndex]?.action_type)
                                        : nodeIcon(node.type)}
                                </span>
                                <span>
                                    <strong>{node.label}</strong>
                                    <small>{node.subtitle}</small>
                                </span>
                                <MousePointer2 className="workflow-node-grip" size={13} />
                            </button>
                        ))}
                    </div>

                    <aside className="workflow-node-panel">
                        <div className="workflow-node-panel-title">
                            {selectedNode?.type === 'message' && typeof selectedNode.stepIndex === 'number'
                                ? actionIcon(form.steps[selectedNode.stepIndex]?.action_type)
                                : nodeIcon(selectedNode?.type || 'trigger')}
                            <div>
                                <strong>{selectedNode?.label || 'Entrada'}</strong>
                                <span>
                                    {selectedNode?.type === 'wait'
                                        ? form.steps[selectedNode.stepIndex || 0]?.action_type === 'wait_only'
                                            ? 'Configure uma pausa independente no fluxo.'
                                            : 'Configure quando o proximo envio deve acontecer.'
                                        : selectedNode?.type === 'message'
                                            ? 'Configure o conteudo que sera enviado depois da espera.'
                                            : selectedNode?.subtitle || 'Configure o bloco selecionado'}
                                </span>
                            </div>
                        </div>

                        {selectedNode?.type === 'trigger' ? (
                            <div className="workflow-panel-fields">
                                <label>
                                    Gatilho de entrada
                                    <select value={form.trigger_type} onChange={e => setForm(p => ({ ...p, trigger_type: e.target.value }))}>
                                        {TRIGGERS.map(trigger => <option value={trigger.value} key={trigger.value}>{trigger.label}</option>)}
                                    </select>
                                </label>
                                <p>Este bloco define quando o fluxo nasce para um lead.</p>
                            </div>
                        ) : null}

                            {selectedNode?.type === 'wait' && typeof selectedNode.stepIndex === 'number' ? (
                                <div className="workflow-panel-fields">
                                    <label>
                                        Tipo de espera
                                        <select
                                            value={form.steps[selectedNode.stepIndex]?.wait_mode || 'relative'}
                                            onChange={e => updateStep(selectedNode.stepIndex!, {
                                                wait_mode: e.target.value === 'datetime' ? 'datetime' : 'relative',
                                            })}
                                        >
                                            <option value="relative">Depois de um tempo</option>
                                            <option value="datetime">Data e hora especifica</option>
                                        </select>
                                    </label>
                                    {(form.steps[selectedNode.stepIndex]?.wait_mode || 'relative') === 'datetime' ? (
                                        <label>
                                            Data e hora
                                            <input
                                                type="datetime-local"
                                                value={toDateTimeLocalValue(form.steps[selectedNode.stepIndex]?.wait_until)}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    wait_until: fromDateTimeLocalValue(e.target.value),
                                                })}
                                            />
                                        </label>
                                    ) : (
                                        <label>
                                            Tempo de espera
                                            <input
                                                type="number"
                                                min={0}
                                                value={form.steps[selectedNode.stepIndex]?.delay_minutes || 0}
                                                onChange={e => updateStep(selectedNode.stepIndex!, { delay_minutes: Number(e.target.value) })}
                                            />
                                        </label>
                                    )}
                                    <label className="workflow-panel-check">
                                        <input
                                            type="checkbox"
                                        checked={form.steps[selectedNode.stepIndex]?.stop_if_replied !== false}
                                        onChange={e => updateStep(selectedNode.stepIndex!, { stop_if_replied: e.target.checked })}
                                    />
                                    Parar se o lead responder antes deste passo
                                </label>
                                <button type="button" className="btn btn-outline btn-small" onClick={() => removeStep(selectedNode.stepIndex!)}>
                                    <Trash2 size={14} />
                                    Remover espera
                                </button>
                            </div>
                        ) : null}

                        {selectedNode?.type === 'message' && typeof selectedNode.stepIndex === 'number' ? (
                            <div className="workflow-panel-fields">
                                <label>
                                    Tipo de envio
                                    <select
                                        value={form.steps[selectedNode.stepIndex]?.action_type || 'text'}
                                        onChange={e => {
                                            const actionType = e.target.value as WorkflowActionType
                                            updateStep(selectedNode.stepIndex!, {
                                                action_type: actionType,
                                                action_payload: defaultPayloadForAction(actionType),
                                                message_template: actionType === 'location_request'
                                                    ? 'Pode me enviar sua localizacao por aqui? Assim eu consigo te indicar as opcoes mais proximas.'
                                                    : form.steps[selectedNode.stepIndex!]?.message_template || '',
                                            })
                                        }}
                                    >
                                        {ACTION_TYPES.filter(action => action.value !== 'wait_only').map(action => <option value={action.value} key={action.value}>{action.label}</option>)}
                                    </select>
                                    <span>{ACTION_TYPES.find(action => action.value === (form.steps[selectedNode.stepIndex!]?.action_type || 'text'))?.hint}</span>
                                </label>
                                <label>
                                    {(form.steps[selectedNode.stepIndex]?.action_type || 'text') === 'text'
                                        ? 'Mensagem do agente'
                                        : form.steps[selectedNode.stepIndex]?.action_type === 'audio_tts'
                                            ? 'Texto fallback opcional'
                                            : 'Texto/legenda junto da midia'}
                                    <textarea
                                        rows={6}
                                        value={form.steps[selectedNode.stepIndex]?.message_template || ''}
                                        onChange={e => updateStep(selectedNode.stepIndex!, { message_template: e.target.value })}
                                    />
                                </label>
                                {form.steps[selectedNode.stepIndex]?.action_type === 'url_buttons' ? (
                                    <>
                                        <label>
                                            Botoes URL
                                            <textarea
                                                rows={4}
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.url_buttons_text || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { url_buttons_text: e.target.value }),
                                                })}
                                                placeholder={'Ver imovel=>https://site.com/imovel\nInstagram=>https://instagram.com/perfil'}
                                            />
                                        </label>
                                        <label>
                                            Imagem opcional do botao
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.image_url || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { image_url: e.target.value }),
                                                })}
                                                placeholder="https://..."
                                            />
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'reply_buttons' ? (
                                    <label>
                                        Opcoes dos botoes
                                        <textarea
                                            rows={4}
                                            value={form.steps[selectedNode.stepIndex]?.action_payload?.reply_options_text || ''}
                                            onChange={e => updateStep(selectedNode.stepIndex!, {
                                                action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { reply_options_text: e.target.value }),
                                            })}
                                            placeholder={'Tenho interesse\nQuero visitar\nMe chama depois'}
                                        />
                                    </label>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'list' ? (
                                    <>
                                        <label>
                                            Texto do botao da lista
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.list_button || 'Ver opcoes'}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { list_button: e.target.value }),
                                                })}
                                            />
                                        </label>
                                        <label>
                                            Itens da lista
                                            <textarea
                                                rows={6}
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.list_choices_text || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { list_choices_text: e.target.value }),
                                                })}
                                                placeholder={'[Imoveis]\nFrente mar|frente_mar|Opcoes frente mar\nCoberturas|coberturas|Coberturas selecionadas'}
                                            />
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'poll' ? (
                                    <>
                                        <label>
                                            Opcoes da enquete
                                            <textarea
                                                rows={4}
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.poll_options_text || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { poll_options_text: e.target.value }),
                                                })}
                                                placeholder={'Moradia\nInvestimento\nOs dois'}
                                            />
                                        </label>
                                        <label className="workflow-panel-check">
                                            <input
                                                type="checkbox"
                                                checked={form.steps[selectedNode.stepIndex]?.action_payload?.poll_multi === true}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { poll_multi: e.target.checked }),
                                                })}
                                            />
                                            Permitir mais de uma opcao
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'audio_tts' ? (
                                    <>
                                        <label>
                                            Voz ElevenLabs
                                            <select
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.voice_id || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { voice_id: e.target.value }),
                                                })}
                                            >
                                                <option value="">Usar voz padrao do agente/sistema</option>
                                                {elevenLabsVoices.filter(v => v.category === 'cloned').map(voice => (
                                                    <option key={voice.voice_id} value={voice.voice_id}>Clonada - {voice.name}</option>
                                                ))}
                                                {elevenLabsVoices.filter(v => v.category !== 'cloned').map(voice => (
                                                    <option key={voice.voice_id} value={voice.voice_id}>{voice.name}</option>
                                                ))}
                                            </select>
                                            <span>O audio sera gerado antes do envio usando o texto abaixo.</span>
                                        </label>
                                        <label>
                                            Texto do audio
                                            <textarea
                                                rows={5}
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.audio_text || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { audio_text: e.target.value }),
                                                })}
                                                placeholder="Oi {nome_lead}, gravei esse audio rapidinho para te explicar..."
                                            />
                                        </label>
                                        <label className="workflow-panel-check">
                                            <input
                                                type="checkbox"
                                                checked={form.steps[selectedNode.stepIndex]?.action_payload?.ptt !== false}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { ptt: e.target.checked }),
                                                })}
                                            />
                                            Enviar como audio de WhatsApp
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'image' ? (
                                    <>
                                        <label>
                                            Enviar imagem para R2
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp,image/gif"
                                                onChange={e => uploadWorkflowMedia(selectedNode.stepIndex!, 'image_url', e.target.files?.[0] || null, 'images', 'image')}
                                            />
                                            <span>{uploadingMedia[`${selectedNode.stepIndex}_image_url`] ? 'Enviando imagem...' : `Limite WhatsApp: ate ${formatFileSize(WORKFLOW_MEDIA_LIMITS.image)}. Ao concluir, a URL abaixo sera preenchida automaticamente.`}</span>
                                        </label>
                                        <label>
                                            URL da imagem
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.image_url || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { image_url: e.target.value }),
                                                })}
                                                placeholder="https://..."
                                            />
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'video' ? (
                                    <>
                                        <label>
                                            Enviar video para R2
                                            <input
                                                type="file"
                                                accept="video/mp4,video/webm"
                                                onChange={e => uploadWorkflowMedia(selectedNode.stepIndex!, 'video_url', e.target.files?.[0] || null, 'videos', 'video')}
                                            />
                                            <span>{uploadingMedia[`${selectedNode.stepIndex}_video_url`] ? 'Enviando video...' : `Limite WhatsApp: ate ${formatFileSize(WORKFLOW_MEDIA_LIMITS.video)}. Use MP4 sempre que possivel.`}</span>
                                        </label>
                                        <label>
                                            URL do video MP4
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.video_url || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { video_url: e.target.value }),
                                                })}
                                                placeholder="https://.../video.mp4"
                                            />
                                        </label>
                                        <label>
                                            Thumbnail opcional
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.thumbnail_url || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { thumbnail_url: e.target.value }),
                                                })}
                                                placeholder="https://.../thumb.jpg"
                                            />
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'document' ? (
                                    <>
                                        <label>
                                            Enviar documento para R2
                                            <input
                                                type="file"
                                                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                                onChange={e => {
                                                    const file = e.target.files?.[0] || null
                                                    if (file && !form.steps[selectedNode.stepIndex!]?.action_payload?.file_name) {
                                                        updateStep(selectedNode.stepIndex!, {
                                                            action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { file_name: file.name }),
                                                        })
                                                    }
                                                    uploadWorkflowMedia(selectedNode.stepIndex!, 'document_url', file, 'documents', 'document')
                                                }}
                                            />
                                            <span>{uploadingMedia[`${selectedNode.stepIndex}_document_url`] ? 'Enviando documento...' : `Limite WhatsApp: ate ${formatFileSize(WORKFLOW_MEDIA_LIMITS.document)}. O arquivo fica salvo no R2 e pronto para envio.`}</span>
                                        </label>
                                        <label>
                                            URL do documento
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.document_url || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { document_url: e.target.value }),
                                                })}
                                                placeholder="https://..."
                                            />
                                        </label>
                                        <label>
                                            Nome do arquivo
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.file_name || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { file_name: e.target.value }),
                                                })}
                                                placeholder="catalogo.pdf"
                                            />
                                        </label>
                                    </>
                                ) : null}
                                {['image', 'video', 'document'].includes(form.steps[selectedNode.stepIndex]?.action_type || '') ? (
                                    <>
                                        <label>
                                            Texto do botao opcional
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.media_button_text || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { media_button_text: e.target.value }),
                                                })}
                                                placeholder="Quer ver mais detalhes?"
                                            />
                                        </label>
                                        <label>
                                            Botao URL opcional apos a midia
                                            <textarea
                                                rows={3}
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.media_url_buttons_text || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { media_url_buttons_text: e.target.value }),
                                                })}
                                                placeholder={'Ver imovel=>https://site.com/imovel\nFalar com corretor=>https://wa.me/5547999999999'}
                                            />
                                            <span>A UAZAPI envia o botao como uma mensagem logo apos a midia.</span>
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'contact' ? (
                                    <>
                                        <label>
                                            Nome do contato
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.contact_name || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { contact_name: e.target.value }),
                                                })}
                                                placeholder="Guilherme Pilger"
                                            />
                                        </label>
                                        <label>
                                            Telefone do contato
                                            <input
                                                value={form.steps[selectedNode.stepIndex]?.action_payload?.contact_phone || ''}
                                                onChange={e => updateStep(selectedNode.stepIndex!, {
                                                    action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { contact_phone: e.target.value }),
                                                })}
                                                placeholder="5547999999999"
                                            />
                                        </label>
                                    </>
                                ) : null}
                                {form.steps[selectedNode.stepIndex]?.action_type === 'carousel' ? (
                                    <label>
                                        Cards do carrossel em JSON
                                        <textarea
                                            rows={8}
                                            value={form.steps[selectedNode.stepIndex]?.action_payload?.carousel_cards_json || ''}
                                            onChange={e => updateStep(selectedNode.stepIndex!, {
                                                action_payload: updateStepPayload(form.steps[selectedNode.stepIndex!], { carousel_cards_json: e.target.value }),
                                            })}
                                            placeholder={'[{"text":"Imovel destaque","image":"https://site.com/foto.jpg","buttons":[{"id":"https://site.com/imovel","text":"Ver imovel","type":"URL"}]}]'}
                                        />
                                    </label>
                                ) : null}
                                <span>Variaveis: {'{nome_lead}'}, {'{phone}'}, {'{finalidade}'}, {'{budget}'}, {'{prazo}'}</span>
                                {form.steps.length > 1 ? (
                                    <button className="btn btn-outline btn-sm danger" type="button" onClick={() => removeStep(selectedNode.stepIndex!)}>
                                        <Trash2 size={14} />
                                        Remover passo
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        {selectedNode?.type === 'end' ? (
                            <div className="workflow-panel-fields">
                                <p>Quando todos os passos terminam, o fluxo encerra e fica registrado na linha do tempo.</p>
                                <div className="workflow-panel-note">
                                    <CheckCircle2 size={15} />
                                    Se o lead responder, os proximos passos podem parar automaticamente.
                                </div>
                            </div>
                        ) : null}
                    </aside>
                </div>

                <div className="workflow-options">
                    <label>
                        <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                        Workflow ativo
                    </label>
                    <label>
                        <input type="checkbox" checked={form.wait_for_online} onChange={e => setForm(p => ({ ...p, wait_for_online: e.target.checked }))} />
                        Aguardar lead online quando suportado
                    </label>
                </div>

                {form.wait_for_online ? (
                    <div className="workflow-online-settings">
                        <label>
                            Esperar online por ate
                            <input
                                type="number"
                                min={5}
                                max={240}
                                value={form.online_wait_max_minutes}
                                onChange={e => setForm(p => ({ ...p, online_wait_max_minutes: Number(e.target.value) }))}
                            />
                            <span>minutos antes de seguir com fallback</span>
                        </label>
                        <label>
                            Checar presenca a cada
                            <input
                                type="number"
                                min={1}
                                max={15}
                                value={form.online_check_interval_minutes}
                                onChange={e => setForm(p => ({ ...p, online_check_interval_minutes: Number(e.target.value) }))}
                            />
                            <span>minutos enquanto aguarda online</span>
                        </label>
                    </div>
                ) : null}

                <div className="workflow-preview">
                    <div><Users size={16} /> Entrada</div>
                    {form.steps.map((workflowStep, index) => (
                        <div className="workflow-preview-step" key={`${workflowStep.id || index}-preview`}>
                            <span />
                            <div><Clock size={16} /> {stepWaitLabel(workflowStep)}</div>
                            {workflowStep.action_type === 'wait_only' ? null : (
                                <>
                                    <span />
                                    <div>{actionIcon(workflowStep.action_type)} {actionTypeLabel(workflowStep.action_type)} {index + 1}</div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <div className="workflow-total-delay">
                    Tempo acumulado se o lead nao responder: {totalDelayMinutes} min
                </div>

                <div className="workflow-actions">
                    {form.id ? <button className="btn btn-outline" onClick={resetBuilder}>Cancelar edicao</button> : null}
                    <button className="btn btn-gold" onClick={saveWorkflow} disabled={saving}>
                        {saving ? <Loader2 size={16} className="spin" /> : form.id ? <Save size={16} /> : <Plus size={16} />}
                        {saving ? 'Salvando...' : form.id ? 'Salvar workflow' : 'Criar workflow'}
                    </button>
                </div>
            </section>

            <section className="workflow-list">
                {workflows.length === 0 ? (
                    <div className="chart-card workflow-empty">
                        <GitBranch size={26} />
                        <strong>Nenhum workflow criado ainda</strong>
                        <span>Crie o primeiro fluxo para iniciar follow-ups por agente.</span>
                    </div>
                ) : workflows.map(workflow => {
                    const broker = workflow.broker_id ? brokerById.get(workflow.broker_id) : null
                    const instance = workflow.broker_id
                        ? instanceByBrokerId.get(workflow.broker_id)
                        : workflow.instance_id ? instanceById.get(workflow.instance_id) : null
                    return (
                        <article className="chart-card workflow-card" key={workflow.id}>
                            <div className="workflow-card-main">
                                <div className={`workflow-status ${workflow.is_active ? 'active' : ''}`}>
                                    <Power size={14} />
                                    {workflow.is_active ? 'Ativo' : 'Pausado'}
                                </div>
                                <h3>{workflow.name}</h3>
                                <p>{workflow.description || extractTemplate(workflow)}</p>
                                <div className="workflow-meta">
                                    <span><Zap size={13} /> {TRIGGERS.find(t => t.value === workflow.trigger_type)?.label || workflow.trigger_type}</span>
                                    <span><Clock size={13} /> {extractTotalDelay(workflow)} min total</span>
                                    <span><MessageSquare size={13} /> {extractSteps(workflow).length} passos</span>
                                    <span><Bot size={13} /> {broker?.name || 'Automático'}</span>
                                    <span><Smartphone size={13} /> {instance?.instance_name || 'Instância do agente'}</span>
                                </div>
                            </div>
                            <div className="workflow-card-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => toggleWorkflow(workflow)}>
                                    {workflow.is_active ? 'Pausar' : 'Ativar'}
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => editWorkflow(workflow)}>Editar</button>
                                <button className="btn btn-outline btn-sm danger" onClick={() => deleteWorkflow(workflow.id)}><Trash2 size={14} /></button>
                            </div>
                        </article>
                    )
                })}
            </section>

            <section className="chart-card workflow-manual-run">
                <div className="workflow-title">
                    <Zap size={20} />
                    <div>
                        <h2>Teste manual</h2>
                        <p>Envia a primeira mensagem agora, sem aguardar os tempos do workflow, para validar agente, WhatsApp e variaveis.</p>
                    </div>
                </div>

                <div className="workflow-manual-grid">
                    <label>
                        Workflow
                        <select
                            value={manualRun.workflow_id}
                            onChange={e => setManualRun(p => ({ ...p, workflow_id: e.target.value }))}
                        >
                            <option value="">Selecione um workflow</option>
                            {workflows.map(workflow => (
                                <option value={workflow.id} key={workflow.id}>{workflow.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Telefone
                        <input
                            value={manualRun.phone}
                            onChange={e => setManualRun(p => ({ ...p, phone: e.target.value }))}
                            placeholder="5547999999999"
                        />
                    </label>
                    <label>
                        Nome opcional
                        <input
                            value={manualRun.name}
                            onChange={e => setManualRun(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nome do teste"
                        />
                    </label>
                    <button className="btn btn-gold" onClick={runWorkflowManually} disabled={running}>
                        {running ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                        {running ? 'Disparando...' : 'Disparar teste'}
                    </button>
                </div>
            </section>

            <section className="chart-card workflow-runs">
                <div className="workflow-title">
                    <MessageSquare size={20} />
                    <div>
                        <h2>Execucoes recentes</h2>
                        <p>Historico curto para confirmar se os fluxos estao disparando.</p>
                    </div>
                </div>
                {runs.length === 0 ? (
                    <div className="workflow-run-empty">Nenhuma execucao registrada ainda.</div>
                ) : runs.map(run => (
                    <div className="workflow-run" key={run.id}>
                        <span className={`run-status ${run.status}`}>{run.status}</span>
                        <strong>{run.lead_name || run.lead_phone || 'Lead sem nome'}</strong>
                        <small>{new Date(run.created_at).toLocaleString('pt-BR')}</small>
                    </div>
                ))}
            </section>

            <section className="chart-card workflow-events">
                <div className="workflow-title">
                    <Activity size={20} />
                    <div>
                        <h2>Linha do tempo</h2>
                        <p>Mostra por que o workflow aguardou, enviou, parou ou caiu no fallback.</p>
                    </div>
                </div>
                {events.length === 0 ? (
                    <div className="workflow-run-empty">Nenhum evento registrado ainda.</div>
                ) : events.slice(0, 20).map(event => {
                    const metadata = event.metadata || {}
                    const detail = metadata.policy_reason
                        || metadata.presence_reason
                        || metadata.reason
                        || metadata.presence?.reason
                        || metadata.preview
                        || event.message
                        || ''
                    return (
                        <div className="workflow-event" key={event.id}>
                            <span className={`event-dot ${event.status || event.event_type}`} />
                            <div>
                                <strong>{eventLabel(event.event_type)}</strong>
                                <small>{event.lead_phone || 'lead sem telefone'}{event.node_id ? ` · ${event.node_id}` : ''}</small>
                            </div>
                            <p>{String(detail || '-')}</p>
                            <time>{new Date(event.created_at).toLocaleString('pt-BR')}</time>
                        </div>
                    )
                })}
            </section>

            <style jsx global>{`
                .automation-page {
                    max-width: none;
                    width: 100%;
                }
                .automation-page .chart-card {
                    width: 100%;
                }
                .admin-header h1 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 0;
                }
                .admin-header p {
                    color: var(--text-muted);
                    font-size: 0.88rem;
                    margin-top: 6px;
                }
                .automation-feedback {
                    border-radius: 8px;
                    font-size: 0.86rem;
                    font-weight: 700;
                    margin-bottom: 16px;
                    padding: 12px 14px;
                }
                .automation-feedback.success {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.25);
                    color: #22c55e;
                }
                .automation-feedback.error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    color: #ef4444;
                }
                .workflow-builder {
                    border-top: 4px solid var(--gold);
                    margin-bottom: 20px;
                }
                .workflow-title {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 18px;
                }
                .workflow-title h2 {
                    font-size: 1.04rem;
                    margin: 0 0 4px;
                }
                .workflow-title p {
                    color: var(--text-muted);
                    font-size: 0.82rem;
                    margin: 0;
                }
                .workflow-form-grid {
                    display: grid;
                    grid-template-columns: minmax(220px, 1.1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(240px, 1.1fr);
                    gap: 14px;
                    align-items: start;
                }
                .workflow-form-grid label,
                .workflow-message {
                    color: var(--text-secondary);
                    display: grid;
                    font-size: 0.78rem;
                    font-weight: 700;
                    gap: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .workflow-form-grid input,
                .workflow-form-grid select,
                .workflow-message textarea {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.9rem;
                    min-height: 42px;
                    outline: none;
                    padding: 0 12px;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .workflow-message {
                    margin-top: 14px;
                }
                .workflow-message textarea {
                    min-height: 98px;
                    padding: 12px;
                    resize: vertical;
                }
                .workflow-form-grid span,
                .workflow-message span {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 500;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .workflow-visual-builder {
                    display: grid;
                    gap: 12px;
                    grid-template-columns: 190px minmax(680px, 1fr) 300px;
                    margin-top: 18px;
                }
                .workflow-block-palette,
                .workflow-node-panel {
                    background: rgba(255, 255, 255, 0.72);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    padding: 12px;
                }
                .workflow-block-palette {
                    align-content: start;
                    display: grid;
                    gap: 8px;
                }
                .workflow-block-palette strong {
                    color: var(--text-primary);
                    font-size: 0.8rem;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                .workflow-palette-section {
                    border-top: 1px solid var(--border);
                    margin-top: 4px;
                    padding-top: 10px;
                }
                .workflow-block-palette button {
                    align-items: center;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    cursor: pointer;
                    display: flex;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.78rem;
                    font-weight: 800;
                    gap: 8px;
                    min-height: 38px;
                    padding: 0 10px;
                    text-align: left;
                }
                .workflow-block-palette button:disabled {
                    cursor: not-allowed;
                    opacity: 0.45;
                }
                .workflow-block-palette span {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    line-height: 1.45;
                }
                .workflow-canvas {
                    background:
                        radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.32) 1px, transparent 0),
                        linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.78));
                    background-size: 22px 22px, 100% 100%;
                    border: 1px solid rgba(201, 169, 110, 0.22);
                    border-radius: 12px;
                    min-height: 520px;
                    overflow: auto;
                    position: relative;
                    touch-action: none;
                }
                .workflow-canvas-grid {
                    height: 520px;
                    min-width: max(1120px, 100%);
                }
                .workflow-lines {
                    height: 520px;
                    left: 0;
                    min-width: max(1120px, 100%);
                    pointer-events: none;
                    position: absolute;
                    top: 0;
                    width: 100%;
                }
                .workflow-lines path {
                    fill: none;
                    stroke: rgba(201, 169, 110, 0.58);
                    stroke-dasharray: 5 6;
                    stroke-linecap: round;
                    stroke-width: 2;
                }
                .workflow-node {
                    align-items: center;
                    background: #fff;
                    border: 1px solid rgba(148, 163, 184, 0.28);
                    border-radius: 12px;
                    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
                    color: var(--text-primary);
                    cursor: grab;
                    display: grid;
                    font-family: 'Inter', sans-serif;
                    gap: 9px;
                    grid-template-columns: 30px minmax(0, 1fr) 14px;
                    min-height: 74px;
                    padding: 10px;
                    position: absolute;
                    text-align: left;
                    user-select: none;
                    width: 168px;
                    z-index: 2;
                }
                .workflow-node:active {
                    cursor: grabbing;
                }
                .workflow-node.selected {
                    border-color: var(--gold);
                    box-shadow: 0 16px 34px rgba(201, 169, 110, 0.2);
                }
                .workflow-node.trigger .workflow-node-icon {
                    background: rgba(34, 197, 94, 0.12);
                    color: #16a34a;
                }
                .workflow-node.wait .workflow-node-icon {
                    background: rgba(245, 158, 11, 0.13);
                    color: #d97706;
                }
                .workflow-node.message .workflow-node-icon {
                    background: rgba(14, 165, 233, 0.12);
                    color: #0284c7;
                }
                .workflow-node.end .workflow-node-icon {
                    background: rgba(139, 92, 246, 0.12);
                    color: #7c3aed;
                }
                .workflow-node-icon {
                    align-items: center;
                    border-radius: 9px;
                    display: inline-flex;
                    height: 30px;
                    justify-content: center;
                    width: 30px;
                }
                .workflow-node strong {
                    display: block;
                    font-size: 0.82rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .workflow-node small {
                    color: var(--text-muted);
                    display: -webkit-box;
                    font-size: 0.68rem;
                    line-height: 1.25;
                    overflow: hidden;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }
                .workflow-node-grip {
                    color: var(--text-muted);
                }
                .workflow-node-panel-title {
                    align-items: center;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    gap: 10px;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                }
                .workflow-node-panel-title strong {
                    color: var(--text-primary);
                    display: block;
                    font-size: 0.88rem;
                }
                .workflow-node-panel-title span {
                    color: var(--text-muted);
                    display: block;
                    font-size: 0.72rem;
                    margin-top: 2px;
                }
                .workflow-panel-fields {
                    display: grid;
                    gap: 10px;
                }
                .workflow-panel-fields label {
                    color: var(--text-secondary);
                    display: grid;
                    font-size: 0.74rem;
                    font-weight: 800;
                    gap: 6px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }
                .workflow-panel-fields input,
                .workflow-panel-fields select,
                .workflow-panel-fields textarea {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.84rem;
                    min-height: 38px;
                    outline: none;
                    padding: 0 10px;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .workflow-panel-fields textarea {
                    line-height: 1.45;
                    min-height: 130px;
                    padding: 10px;
                    resize: vertical;
                }
                .workflow-panel-fields p,
                .workflow-panel-fields span {
                    color: var(--text-muted);
                    font-size: 0.74rem;
                    line-height: 1.45;
                    margin: 0;
                }
                .workflow-panel-check,
                .workflow-panel-note {
                    align-items: center;
                    background: rgba(201, 169, 110, 0.08);
                    border: 1px solid rgba(201, 169, 110, 0.2);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    display: flex !important;
                    font-size: 0.76rem !important;
                    gap: 8px !important;
                    letter-spacing: 0 !important;
                    min-height: 40px;
                    padding: 8px 10px;
                    text-transform: none !important;
                }
                .workflow-panel-check input {
                    accent-color: var(--gold);
                    min-height: auto;
                }
                .workflow-steps {
                    display: grid;
                    gap: 12px;
                    margin-top: 16px;
                }
                .workflow-steps-header {
                    align-items: center;
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                }
                .workflow-steps-header div {
                    display: grid;
                    gap: 4px;
                }
                .workflow-steps-header strong {
                    color: var(--text-primary);
                    font-size: 0.9rem;
                }
                .workflow-steps-header span {
                    color: var(--text-muted);
                    font-size: 0.78rem;
                }
                .workflow-step-card {
                    background: rgba(201, 169, 110, 0.045);
                    border: 1px solid rgba(201, 169, 110, 0.2);
                    border-radius: 8px;
                    padding: 12px;
                }
                .workflow-step-header {
                    align-items: center;
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .workflow-step-header span {
                    color: var(--text-primary);
                    font-size: 0.78rem;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                .workflow-step-grid {
                    align-items: end;
                    display: grid;
                    gap: 12px;
                    grid-template-columns: minmax(180px, 260px) minmax(240px, 1fr);
                }
                .workflow-step-grid label,
                .workflow-step-toggle {
                    color: var(--text-secondary);
                    display: grid;
                    font-size: 0.78rem;
                    font-weight: 700;
                    gap: 6px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }
                .workflow-step-grid input[type="number"] {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.9rem;
                    min-height: 42px;
                    outline: none;
                    padding: 0 12px;
                }
                .workflow-step-grid span {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 500;
                    letter-spacing: 0;
                    text-transform: none;
                }
                .workflow-step-toggle {
                    align-items: center;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    display: flex;
                    min-height: 42px;
                    padding: 0 12px;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .workflow-step-toggle input {
                    accent-color: var(--gold);
                }
                .workflow-options {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 14px;
                    margin: 16px 0;
                }
                .workflow-options label {
                    align-items: center;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    display: inline-flex;
                    gap: 8px;
                    min-height: 38px;
                    padding: 0 12px;
                    font-size: 0.82rem;
                    font-weight: 700;
                }
                .workflow-options input {
                    accent-color: var(--gold);
                }
                .workflow-online-settings {
                    background: rgba(14, 165, 233, 0.06);
                    border: 1px solid rgba(14, 165, 233, 0.2);
                    border-radius: 8px;
                    display: grid;
                    gap: 12px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    margin: -4px 0 16px;
                    padding: 12px;
                }
                .workflow-online-settings label {
                    color: var(--text-secondary);
                    display: grid;
                    font-size: 0.78rem;
                    font-weight: 700;
                    gap: 6px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }
                .workflow-online-settings input {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.9rem;
                    min-height: 42px;
                    outline: none;
                    padding: 0 12px;
                }
                .workflow-online-settings span {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 500;
                    letter-spacing: 0;
                    text-transform: none;
                }
                .workflow-preview {
                    align-items: center;
                    display: flex;
                    gap: 10px;
                    margin: 12px 0 18px;
                    overflow-x: auto;
                }
                .workflow-preview > div:not(.workflow-preview-step),
                .workflow-preview-step > div {
                    align-items: center;
                    background: rgba(201, 169, 110, 0.08);
                    border: 1px solid rgba(201, 169, 110, 0.22);
                    border-radius: 8px;
                    color: var(--text-primary);
                    display: inline-flex;
                    gap: 8px;
                    min-height: 42px;
                    padding: 0 14px;
                    white-space: nowrap;
                }
                .workflow-preview-step {
                    align-items: center;
                    display: flex;
                    gap: 10px;
                }
                .workflow-preview span,
                .workflow-preview-step span {
                    background: var(--border);
                    flex: 0 0 34px;
                    height: 1px;
                }
                .workflow-total-delay {
                    color: var(--text-muted);
                    font-size: 0.78rem;
                    font-weight: 700;
                    margin: -6px 0 18px;
                }
                .workflow-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .workflow-list {
                    display: grid;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .workflow-manual-run {
                    border-top: 4px solid #0ea5e9;
                    margin-bottom: 20px;
                }
                .workflow-manual-grid {
                    align-items: end;
                    display: grid;
                    grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.8fr) minmax(180px, 0.8fr) auto;
                    gap: 12px;
                }
                .workflow-manual-grid label {
                    color: var(--text-secondary);
                    display: grid;
                    font-size: 0.78rem;
                    font-weight: 700;
                    gap: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .workflow-manual-grid input,
                .workflow-manual-grid select {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.9rem;
                    min-height: 42px;
                    outline: none;
                    padding: 0 12px;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .workflow-card {
                    align-items: center;
                    display: flex;
                    gap: 16px;
                    justify-content: space-between;
                    margin-bottom: 0;
                }
                .workflow-card h3 {
                    font-size: 1rem;
                    margin: 8px 0 5px;
                }
                .workflow-card p {
                    color: var(--text-muted);
                    font-size: 0.82rem;
                    line-height: 1.45;
                    margin: 0 0 10px;
                }
                .workflow-status {
                    align-items: center;
                    border: 1px solid rgba(148, 163, 184, 0.24);
                    border-radius: 999px;
                    color: var(--text-muted);
                    display: inline-flex;
                    gap: 6px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    padding: 4px 9px;
                    text-transform: uppercase;
                }
                .workflow-status.active {
                    background: rgba(34, 197, 94, 0.1);
                    border-color: rgba(34, 197, 94, 0.28);
                    color: #22c55e;
                }
                .workflow-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .workflow-meta span {
                    align-items: center;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 999px;
                    color: var(--text-muted);
                    display: inline-flex;
                    gap: 5px;
                    font-size: 0.72rem;
                    padding: 5px 8px;
                }
                .workflow-card-actions {
                    display: flex;
                    flex: 0 0 auto;
                    gap: 8px;
                }
                .workflow-card-actions .danger {
                    color: #ef4444;
                }
                .workflow-empty {
                    align-items: center;
                    color: var(--text-muted);
                    display: grid;
                    gap: 8px;
                    justify-items: center;
                    padding: 34px;
                    text-align: center;
                }
                .workflow-empty strong {
                    color: var(--text-primary);
                }
                .workflow-runs {
                    margin-bottom: 20px;
                }
                .workflow-events {
                    margin-bottom: 0;
                }
                .workflow-run-empty {
                    color: var(--text-muted);
                    font-size: 0.84rem;
                }
                .workflow-run {
                    align-items: center;
                    border-top: 1px solid var(--border);
                    display: grid;
                    gap: 10px;
                    grid-template-columns: 100px minmax(0, 1fr) 160px;
                    padding: 11px 0;
                }
                .run-status {
                    border-radius: 999px;
                    border: 1px solid var(--border);
                    color: var(--text-muted);
                    font-size: 0.68rem;
                    font-weight: 800;
                    padding: 4px 8px;
                    text-align: center;
                    text-transform: uppercase;
                }
                .run-status.sent,
                .run-status.completed {
                    color: #22c55e;
                    border-color: rgba(34, 197, 94, 0.32);
                }
                .run-status.failed {
                    color: #ef4444;
                    border-color: rgba(239, 68, 68, 0.32);
                }
                .workflow-run strong {
                    color: var(--text-primary);
                    font-size: 0.84rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .workflow-run small {
                    color: var(--text-muted);
                    font-size: 0.76rem;
                    text-align: right;
                }
                .workflow-event {
                    align-items: center;
                    border-top: 1px solid var(--border);
                    display: grid;
                    gap: 12px;
                    grid-template-columns: 18px minmax(160px, 0.6fr) minmax(0, 1fr) 150px;
                    padding: 11px 0;
                }
                .event-dot {
                    background: var(--text-muted);
                    border-radius: 999px;
                    height: 10px;
                    width: 10px;
                }
                .event-dot.sent,
                .event-dot.running,
                .event-dot.message_sent,
                .event-dot.lead_online_detected {
                    background: #22c55e;
                }
                .event-dot.waiting,
                .event-dot.workflow_waiting,
                .event-dot.waiting_for_lead_online {
                    background: #f59e0b;
                }
                .event-dot.failed,
                .event-dot.workflow_failed {
                    background: #ef4444;
                }
                .event-dot.stopped,
                .event-dot.workflow_stopped {
                    background: #8b5cf6;
                }
                .workflow-event strong {
                    color: var(--text-primary);
                    display: block;
                    font-size: 0.82rem;
                }
                .workflow-event small {
                    color: var(--text-muted);
                    display: block;
                    font-size: 0.72rem;
                    margin-top: 3px;
                }
                .workflow-event p {
                    color: var(--text-muted);
                    font-size: 0.78rem;
                    margin: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .workflow-event time {
                    color: var(--text-muted);
                    font-size: 0.74rem;
                    text-align: right;
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 920px) {
                    .automation-page {
                        max-width: 100%;
                    }
                    .workflow-form-grid {
                        grid-template-columns: 1fr;
                    }
                    .workflow-visual-builder {
                        grid-template-columns: 1fr;
                    }
                    .workflow-block-palette {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                    .workflow-block-palette strong,
                    .workflow-block-palette span {
                        grid-column: 1 / -1;
                    }
                    .workflow-canvas {
                        min-height: 340px;
                    }
                    .workflow-canvas-grid,
                    .workflow-lines {
                        height: 340px;
                        min-width: 820px;
                    }
                    .workflow-node {
                        width: 156px;
                    }
                    .workflow-card,
                    .workflow-card-actions {
                        align-items: stretch;
                        flex-direction: column;
                    }
                    .workflow-card-actions .btn {
                        justify-content: center;
                    }
                    .workflow-run {
                        grid-template-columns: 1fr;
                    }
                    .workflow-run small {
                        text-align: left;
                    }
                    .workflow-event,
                    .workflow-online-settings {
                        grid-template-columns: 1fr;
                    }
                    .workflow-event time {
                        text-align: left;
                    }
                    .workflow-actions {
                        flex-direction: column;
                    }
                    .workflow-actions .btn {
                        justify-content: center;
                    }
                    .workflow-steps-header,
                    .workflow-step-grid {
                        grid-template-columns: 1fr;
                    }
                    .workflow-steps-header {
                        align-items: stretch;
                        flex-direction: column;
                    }
                    .workflow-manual-grid {
                        grid-template-columns: 1fr;
                    }
                    .workflow-manual-grid .btn {
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    )
}
