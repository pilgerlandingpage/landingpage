import { generateChatResponse } from '@/lib/ai/generation'
import { sendAudioMessage, sendMenuMessage, sendWhatsAppMessage, setPresenceRecording, setPresenceTyping } from '@/lib/connectyhub/whatsapp'
import { generateWorkflowElevenLabsAudioUrl } from '@/lib/workflows/tts-audio'
import { PROFILE_ASSESSMENT_VOTE_URL } from '@/lib/whatsapp/profile-assessment-gate'

export type ProfileAssessmentReplyChannel = 'text' | 'audio'

type DeliveryConfig = Record<string, string>

const TEXT_PART_DELAY_MS = 3500
const AUDIO_PART_DELAY_MS = 6500
const BUTTON_DELAY_MS = 4500

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function humanDelay(baseMs: number, variance = 0.35) {
    const spread = Math.floor(baseMs * variance)
    return Math.max(600, baseMs - spread + Math.floor(Math.random() * (spread * 2 + 1)))
}

function composeDelayForText(text: string, minMs = 900, maxMs = 3600) {
    const raw = 650 + String(text || '').length * 18
    return Math.min(maxMs, Math.max(minMs, humanDelay(raw, 0.28)))
}

function cleanText(value: unknown, max = 1200) {
    return String(value || '')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max)
}

function normalizeName(value: unknown) {
    const raw = cleanText(value, 80)
    if (!raw || /^(desconhecido|unknown|lead sem nome|sem nome|contato whatsapp)$/i.test(raw)) return ''
    return raw.split(/\s+/).slice(0, 2).join(' ')
}

function pickVariant<T>(variants: T[], seed: unknown): T {
    if (!variants.length) throw new Error('No variants available.')
    if (variants.length === 1) return variants[0] as T
    const source = `${String(seed || '')}:${Date.now()}`
    let hash = 0
    for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0
    }
    return variants[Math.abs(hash) % variants.length] || variants[0] as T
}

function splitTextForWhatsApp(text: string) {
    const normalized = cleanText(text, 1800)
    if (!normalized) return []

    const paragraphs = normalized
        .split(/\n{2,}/)
        .map(part => part.trim())
        .filter(Boolean)

    if (paragraphs.length >= 2) return paragraphs.slice(0, 4)
    if (normalized.length <= 180) return [normalized]

    const sentences = normalized
        .split(/(?<=[.!?])\s+/)
        .map(part => part.trim())
        .filter(Boolean)

    const chunks: string[] = []
    let current = ''
    for (const sentence of sentences) {
        if (!current) {
            current = sentence
            continue
        }
        if ((current + ' ' + sentence).length <= 230) {
            current = `${current} ${sentence}`
        } else {
            chunks.push(current)
            current = sentence
        }
    }
    if (current) chunks.push(current)

    return chunks.length ? chunks.slice(0, 4) : [normalized.slice(0, 320)]
}

function replaceWordPreservingCase(text: string, source: string, target: string) {
    const pattern = new RegExp(`\\b${source}\\b`, 'gi')
    return text.replace(pattern, match => {
        const capitalized = target.charAt(0).toUpperCase() + target.slice(1)
        return match.charAt(0) === match.charAt(0).toUpperCase() ? capitalized : target
    })
}

function polishProfileAssessmentText(value: unknown, max = 650) {
    const replacements: Array<[string, string]> = [
        ['voce', 'você'],
        ['analise', 'análise'],
        ['avaliacao', 'avaliação'],
        ['autoavaliacao', 'autoavaliação'],
        ['diagnostico', 'diagnóstico'],
        ['relatorio', 'relatório'],
        ['botao', 'botão'],
        ['votacao', 'votação'],
        ['confirmacao', 'confirmação'],
        ['proximo', 'próximo'],
        ['metodo', 'método'],
        ['gratis', 'grátis'],
        ['rapida', 'rápida'],
        ['tambem', 'também'],
        ['sera', 'será'],
        ['nao', 'não'],
    ]
    let output = cleanText(value, max)
    for (const [source, target] of replacements) {
        output = replaceWordPreservingCase(output, source, target)
    }
    output = output
        .replace(/\bGuilherme pilger\b/gi, 'Guilherme Pilger')
        .replace(/\bwhatsapp\b/gi, 'WhatsApp')
        .replace(/\bperfil do corretor ideal\b/gi, 'Perfil do Corretor Ideal')
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/([.!?]){2,}/g, '$1')
        .trim()

    if (output && !/[.!?:)]$/.test(output)) output = `${output}.`
    return output
}

function parseModelParts(raw: string) {
    const candidate = raw.match(/\[[\s\S]*\]/)?.[0] || raw
    try {
        const parsed = JSON.parse(candidate)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map(item => polishProfileAssessmentText(item, 650))
            .filter(Boolean)
            .slice(0, 4)
    } catch {
        return splitTextForWhatsApp(raw).slice(0, 4)
    }
}

function fallbackVotePitchParts(name?: string | null) {
    const firstName = normalizeName(name)
    const opener = firstName ? `${firstName}, perfeito. Eu libero sim o Perfil do Corretor Ideal para você.` : 'Perfeito. Eu libero sim o Perfil do Corretor Ideal para você.'
    return [
        opener,
        'Eu e meu time construímos uma ferramenta bem sofisticada para ajudar o corretor a enxergar com clareza onde ele está forte, onde está deixando dinheiro na mesa e qual deve ser o próximo passo da rotina comercial.',
        'Eu estou liberando essa análise gratuitamente porque quero que mais corretores tenham acesso a esse método. Em troca, eu te peço uma ajuda simples e importante: votar em mim como Influenciador do Ano.',
        'Clica no botão da votação, confirma seu voto e me manda o comprovante da tela final aqui. Pode ser print, vídeo curto ou PDF legível. Assim que eu validar, eu te envio o botão com o acesso ao sistema.',
    ]
}

function fallbackVoteReminderParts(name?: string | null, userText?: string | null) {
    const firstName = normalizeName(name)
    const opener = firstName ? `${firstName}, eu te explico com calma.` : 'Eu te explico com calma.'
    const variants = [
        [
            'Eu e meu time construímos o Perfil do Corretor Ideal para entregar uma leitura bem prática da sua postura comercial: pontos fortes, pontos de melhoria e próximo passo.',
            'Como estou liberando essa análise gratuitamente, eu peço essa troca: toca no botão, vota em mim como Influenciador do Ano e me manda o comprovante da tela final.',
            'Assim que eu validar esse comprovante aqui no WhatsApp, eu te envio o botão com o acesso ao sistema.',
        ],
        [
            'A ferramenta cruza suas respostas e devolve uma leitura objetiva sobre comportamento, rotina comercial e pontos que podem estar travando resultado.',
            'Para eu liberar esse acesso gratuito, preciso só da sua ajuda na votação: toca no botão, confirma seu voto em mim e me manda o comprovante final.',
            'Quando o comprovante chegar aqui, eu valido e te envio o botão da análise como combinado.',
        ],
        [
            'Não é só um teste simples. É uma análise para o corretor entender onde está forte, onde precisa ajustar e qual ação prática pode melhorar a semana comercial.',
            'Eu estou abrindo isso de forma gratuita, e a troca é simples: você me ajuda votando em mim como Influenciador do Ano.',
            'Depois do voto, me manda o comprovante da confirmação final por aqui. Validando, eu libero o link da ferramenta.',
        ],
    ]
    return [opener, ...pickVariant(variants, `${name || ''}:${userText || ''}`)]
}

export async function buildProfileAssessmentVotePitch(params: {
    userText?: string | null
    name?: string | null
    identityType?: string | null
    configs?: DeliveryConfig | null
}) {
    const fallback = fallbackVotePitchParts(params.name)
    const configs = params.configs || {}

    try {
        const provider = configs.ai_provider === 'openai' ? 'openai' : 'gemini'
        const configuredPrompt = cleanText(configs.whatsapp_global_system_prompt, 4000)
        const raw = await generateChatResponse(
            [],
            [
                `Nome percebido: ${normalizeName(params.name) || 'não informado'}`,
                `Perfil resolvido: ${params.identityType || 'lead'}`,
                `Mensagem recebida: ${cleanText(params.userText, 600) || 'pedido de acesso à ferramenta'}`,
                `Variação da resposta: ${new Date().toISOString()}`,
            ].join('\n'),
            [
                'Você é Guilherme Pilger escrevendo no WhatsApp em primeira pessoa.',
                'Responda somente um JSON array de 3 ou 4 strings. Sem markdown.',
                configuredPrompt ? `Comportamento do agente configurado no painel:\n${configuredPrompt}` : '',
                '',
                'Objetivo da resposta:',
                '- escrever em português brasileiro correto, com acentos, vírgulas, pontos e pontuação natural para áudio;',
                '- acolher com educação e calor humano;',
                '- falar sempre em primeira pessoa, como o próprio Guilherme, usando "eu", "meu" e "votar em mim";',
                '- explicar com mais substância que eu e meu time construímos uma ferramenta sofisticada chamada Perfil do Corretor Ideal;',
                '- explicar que ela ajuda o corretor a entender pontos fortes, pontos de melhoria, postura comercial e próximo passo prático;',
                '- deixar claro que eu estou liberando a ferramenta gratuitamente;',
                '- apresentar a troca de energia: eu libero a ferramenta e a pessoa me ajuda votando em mim como Influenciador do Ano;',
                '- pedir para votar e enviar o comprovante da confirmação aqui no WhatsApp; pode ser print, vídeo curto ou PDF legível;',
                '- não falar de livro, desconto, checkout ou cupom nessa etapa;',
                '- não incluir URL, porque o link será enviado em botão separado;',
                '- usar frases naturais, calorosas e com cara de áudio de WhatsApp brasileiro;',
                '- não escrever como assistente, atendente ou terceira pessoa falando sobre o Guilherme.',
            ].filter(Boolean).join('\n'),
            {
                provider,
                geminiModel: configs.gemini_model || undefined,
                openaiModel: configs.openai_model || undefined,
            }
        )
        const parts = parseModelParts(raw)
        return parts.length ? parts : fallback
    } catch {
        return fallback
    }
}

export async function buildProfileAssessmentReminderPitch(params: {
    userText?: string | null
    name?: string | null
    identityType?: string | null
    configs?: DeliveryConfig | null
}) {
    const fallback = fallbackVoteReminderParts(params.name, params.userText)
    const configs = params.configs || {}

    try {
        const provider = configs.ai_provider === 'openai' ? 'openai' : 'gemini'
        const configuredPrompt = cleanText(configs.whatsapp_global_system_prompt, 4000)
        const raw = await generateChatResponse(
            [],
            [
                `Nome percebido: ${normalizeName(params.name) || 'não informado'}`,
                `Perfil resolvido: ${params.identityType || 'lead'}`,
                `Mensagem atual do lead: ${cleanText(params.userText, 600) || 'pediu novamente o acesso à ferramenta'}`,
                `Variação da resposta: ${new Date().toISOString()}`,
            ].join('\n'),
            [
                'Você é Guilherme Pilger escrevendo no WhatsApp em primeira pessoa.',
                'A pessoa já recebeu a explicação inicial ou está pedindo de novo o acesso ao Perfil do Corretor Ideal.',
                'Responda somente um JSON array de 3 ou 4 strings. Sem markdown.',
                configuredPrompt ? `Comportamento do agente configurado no painel:\n${configuredPrompt}` : '',
                '',
                'Objetivo da resposta:',
                '- escrever em português brasileiro correto, com acentos, vírgulas, pontos e pontuação natural para áudio;',
                '- responder de forma nova e personalizada ao que a pessoa acabou de falar;',
                '- falar sempre em primeira pessoa, como o próprio Guilherme, usando "eu", "meu" e "votar em mim";',
                '- reexplicar com cordialidade que eu construí com meu time uma ferramenta sofisticada para ajudar o corretor;',
                '- dizer que a ferramenta é gratuita, mas o acesso é liberado depois da pessoa votar em mim como Influenciador do Ano e enviar o comprovante da confirmação;',
                '- não soar robótico, não repetir literalmente uma mensagem anterior, não falar como atendente;',
                '- não incluir URL, porque o botão será enviado separadamente;',
                '- não falar de livro, desconto, checkout ou cupom nessa etapa.',
            ].filter(Boolean).join('\n'),
            {
                provider,
                geminiModel: configs.gemini_model || undefined,
                openaiModel: configs.openai_model || undefined,
            }
        )
        const parts = parseModelParts(raw)
        return parts.length ? parts : fallback
    } catch {
        return fallback
    }
}

async function sendTextParts(params: {
    phone: string
    instanceToken: string
    parts: string[]
}) {
    const chunks = params.parts
        .map(part => polishProfileAssessmentText(part, 700))
        .flatMap(splitTextForWhatsApp)
        .filter(Boolean)
    for (let index = 0; index < chunks.length; index += 1) {
        await setPresenceTyping(params.phone, params.instanceToken).catch(() => null)
        await wait(composeDelayForText(chunks[index]))
        await sendWhatsAppMessage({
            phone: params.phone,
            instanceToken: params.instanceToken,
            message: chunks[index],
        })
        if (index < chunks.length - 1) {
            await wait(humanDelay(TEXT_PART_DELAY_MS))
        }
    }
}

async function sendAudioPartsOrText(params: {
    phone: string
    instanceToken: string
    parts: string[]
    configs?: DeliveryConfig | null
}) {
    const parts = params.parts.map(part => polishProfileAssessmentText(part, 700)).filter(Boolean)
    try {
        for (let index = 0; index < parts.length; index += 1) {
            await setPresenceRecording(params.phone, params.instanceToken).catch(() => null)
            const audioUrl = await generateWorkflowElevenLabsAudioUrl(parts[index], params.configs?.whatsapp_tts_voice)
            await wait(composeDelayForText(parts[index], 900, 2800))
            await sendAudioMessage({
                phone: params.phone,
                instanceToken: params.instanceToken,
                audioUrl,
                ptt: true,
            })
            if (index < parts.length - 1) {
                await wait(humanDelay(AUDIO_PART_DELAY_MS))
            }
        }
    } catch {
        await sendTextParts({
            phone: params.phone,
            instanceToken: params.instanceToken,
            parts,
        })
    }
}

export async function sendProfileAssessmentUrlButton(params: {
    phone: string
    instanceToken: string
    text: string
    label: string
    url: string
    footerText?: string
}) {
    try {
        await setPresenceTyping(params.phone, params.instanceToken).catch(() => null)
        await wait(composeDelayForText(params.text, 900, 2400))
        await sendMenuMessage({
            phone: params.phone,
            instanceToken: params.instanceToken,
            text: params.text,
            type: 'button',
            choices: [`${params.label.slice(0, 24)}|url:${params.url}`],
            footerText: params.footerText,
        })
        return { sentAsButton: true }
    } catch {
        await setPresenceTyping(params.phone, params.instanceToken).catch(() => null)
        await wait(composeDelayForText(params.text, 900, 2400))
        await sendWhatsAppMessage({
            phone: params.phone,
            instanceToken: params.instanceToken,
            message: `${params.text}\n\n${params.label}: ${params.url}`,
        })
        return { sentAsButton: false }
    }
}

export async function sendProfileAssessmentVoteRequest(params: {
    phone: string
    instanceToken: string
    channel: ProfileAssessmentReplyChannel
    userText?: string | null
    name?: string | null
    identityType?: string | null
    configs?: DeliveryConfig | null
}) {
    const parts = await buildProfileAssessmentVotePitch(params)
    if (params.channel === 'audio') {
        await sendAudioPartsOrText({
            phone: params.phone,
            instanceToken: params.instanceToken,
            parts,
            configs: params.configs,
        })
    } else {
        await sendTextParts({
            phone: params.phone,
            instanceToken: params.instanceToken,
            parts,
        })
    }

    await wait(humanDelay(BUTTON_DELAY_MS))
    await sendProfileAssessmentUrlButton({
        phone: params.phone,
        instanceToken: params.instanceToken,
        text: 'Toque no botão para abrir a votação oficial. Depois me mande o comprovante da tela final de confirmação.',
        label: 'Votar em mim',
        url: PROFILE_ASSESSMENT_VOTE_URL,
        footerText: 'Perfil do Corretor Ideal',
    })
}

export async function sendProfileAssessmentToolReleased(params: {
    phone: string
    instanceToken: string
    toolUrl: string
}) {
    await sendProfileAssessmentUrlButton({
        phone: params.phone,
        instanceToken: params.instanceToken,
        text: 'Obrigado por votar em mim. Como prometido, liberei aqui o acesso para a sua análise gratuita.',
        label: 'Abrir ferramenta',
        url: params.toolUrl,
        footerText: 'Perfil do Corretor Ideal',
    })
}

export async function sendProfileAssessmentReminder(params: {
    phone: string
    instanceToken: string
    channel: ProfileAssessmentReplyChannel
    userText?: string | null
    name?: string | null
    identityType?: string | null
    configs?: DeliveryConfig | null
}) {
    const parts = await buildProfileAssessmentReminderPitch(params)
    if (params.channel === 'audio') {
        await sendAudioPartsOrText({
            phone: params.phone,
            instanceToken: params.instanceToken,
            parts,
            configs: params.configs,
        })
    } else {
        await sendTextParts({ phone: params.phone, instanceToken: params.instanceToken, parts })
    }

    await wait(humanDelay(BUTTON_DELAY_MS))
    await sendProfileAssessmentUrlButton({
        phone: params.phone,
        instanceToken: params.instanceToken,
        text: 'Vou deixar o botão da votação aqui de novo. Depois me manda o comprovante da confirmação final.',
        label: 'Votar em mim',
        url: PROFILE_ASSESSMENT_VOTE_URL,
        footerText: 'Perfil do Corretor Ideal',
    })
}
