import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createAdminClient } from '@/lib/supabase/server'

type TtsConfig = Record<string, string>

async function loadConfig(keys: string[]): Promise<TtsConfig> {
    const supabase = createAdminClient()
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', keys)

    const cfg: TtsConfig = {}
    for (const row of data || []) cfg[row.key] = row.value
    return cfg
}

function numberUnderThousandToWordsPtBR(value: number): string {
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

    if (value === 0) return 'zero'
    if (value === 100) return 'cem'
    if (value < 10) return units[value]
    if (value < 20) return teens[value - 10]
    if (value < 100) {
        const ten = Math.floor(value / 10)
        const unit = value % 10
        return unit ? `${tens[ten]} e ${units[unit]}` : tens[ten]
    }

    const hundred = Math.floor(value / 100)
    const rest = value % 100
    return rest ? `${hundreds[hundred]} e ${numberUnderThousandToWordsPtBR(rest)}` : hundreds[hundred]
}

function integerToWordsPtBR(value: number): string {
    if (!Number.isFinite(value)) return ''
    const number = Math.floor(Math.abs(value))
    if (number < 1000) return numberUnderThousandToWordsPtBR(number)

    const scales = [
        { value: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
        { value: 1_000_000, singular: 'milhão', plural: 'milhões' },
        { value: 1_000, singular: 'mil', plural: 'mil' },
    ]

    for (const scale of scales) {
        if (number >= scale.value) {
            const major = Math.floor(number / scale.value)
            const rest = number % scale.value
            const majorText = scale.value === 1_000 && major === 1
                ? 'mil'
                : `${integerToWordsPtBR(major)} ${major === 1 ? scale.singular : scale.plural}`
            if (!rest) return majorText
            return `${majorText}${rest < 100 ? ' e ' : ', '}${integerToWordsPtBR(rest)}`
        }
    }

    return String(number)
}

function parseBrazilianMoney(value: string): { reais: number; cents: number } | null {
    const raw = value.replace(/R\$/gi, '').replace(/\s+/g, '').trim()
    if (!raw) return null

    let integerPart = raw
    let centsPart = ''
    if (raw.includes(',')) {
        const parts = raw.split(',')
        integerPart = parts[0] || ''
        centsPart = parts[1] || ''
    } else if (/^\d{1,3}\.\d{2}$/.test(raw)) {
        const parts = raw.split('.')
        integerPart = parts[0] || ''
        centsPart = parts[1] || ''
    } else if (/^\d{1,3}(?:\.\d{3})+\.\d{2}$/.test(raw)) {
        const parts = raw.split('.')
        integerPart = `${parts.slice(0, -1).join('')}${parts[parts.length - 1]}0`
    }

    const integerRaw = (integerPart || '').replace(/\D/g, '')
    if (!integerRaw) return null

    const reais = Number(integerRaw)
    const centsRaw = (centsPart || '').replace(/\D/g, '').slice(0, 2)
    const cents = centsRaw ? Number(centsRaw.padEnd(2, '0')) : 0
    if (!Number.isFinite(reais) || reais < 0) return null
    return { reais, cents: Number.isFinite(cents) ? cents : 0 }
}

function moneyToSpeechPtBR(value: string): string {
    const parsed = parseBrazilianMoney(value)
    if (!parsed) return value
    const reaisText = parsed.reais === 1 ? 'um real' : `${integerToWordsPtBR(parsed.reais)} reais`
    if (!parsed.cents) return reaisText
    const centsText = parsed.cents === 1 ? 'um centavo' : `${integerToWordsPtBR(parsed.cents)} centavos`
    return `${reaisText} e ${centsText}`
}

function parseScaledNumberPtBR(value: string): number | null {
    let normalized = String(value || '').trim().replace(/\s+/g, '')
    if (!normalized) return null
    if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.')
    const number = Number(normalized)
    return Number.isFinite(number) ? number : null
}

function scaleWordToMultiplier(scale: string): number {
    const normalized = String(scale || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    if (normalized.startsWith('bilh')) return 1_000_000_000
    if (normalized.startsWith('milh') || normalized === 'mi') return 1_000_000
    if (normalized === 'mil' || normalized === 'k') return 1_000
    return 1
}

function scaledMoneyToSpeechPtBR(value: string, scale: string): string {
    const number = parseScaledNumberPtBR(value)
    if (number === null) return `${value} ${scale}`
    const reais = Math.round(number * scaleWordToMultiplier(scale))
    return reais === 1 ? 'um real' : `${integerToWordsPtBR(reais)} reais`
}

export function normalizeTextForWorkflowTTS(text: string): string {
    const scalePattern = '(?:bilh(?:ao|oes|\\u00e3o|\\u00f5es)|milh(?:ao|oes|\\u00e3o|\\u00f5es)|milhao|milhoes|mi|mil|k)'
    return String(text || '')
        .replace(new RegExp(`R\\$\\s*(\\d+(?:[,.]\\d+)?)\\s*(${scalePattern})\\b(?:\\s+de\\s+reais)?`, 'gi'), (_, value, scale) => scaledMoneyToSpeechPtBR(value, scale))
        .replace(new RegExp(`\\b(\\d+(?:[,.]\\d+)?)\\s*(${scalePattern})\\s*(?:de\\s+)?reais\\b`, 'gi'), (_, value, scale) => scaledMoneyToSpeechPtBR(value, scale))
        .replace(/R\$\s*\d[\d.\s]*(?:,\d{1,2})?/gi, match => moneyToSpeechPtBR(match))
        .replace(/\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b/g, match => {
            const parsed = parseBrazilianMoney(match)
            return parsed ? integerToWordsPtBR(parsed.reais) : match
        })
        .replace(/\b(\d{1,3})\s*(?:m2|m\u00b2)\b/gi, (_, value) => `${integerToWordsPtBR(Number(value))} metros quadrados`)
        .replace(/\b(\d{1,3})\s*%/g, (_, value) => `${integerToWordsPtBR(Number(value))} por cento`)
        .replace(new RegExp(`\\b(\\d{1,2})\\s*(${scalePattern})\\b`, 'gi'), (_, value, scale) => `${integerToWordsPtBR(Number(value))} ${String(scale).toLowerCase()}`)
        .replace(/\s+/g, ' ')
        .trim()
}

async function uploadWorkflowAudio(buffer: Buffer): Promise<string> {
    const supabase = createAdminClient()
    const cfg = await loadConfig([
        'r2_account_id',
        'r2_access_key_id',
        'r2_secret_access_key',
        'r2_bucket_name',
        'r2_public_url',
    ])

    const accountId = cfg.r2_account_id || process.env.R2_ACCOUNT_ID
    const accessKeyId = cfg.r2_access_key_id || process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = cfg.r2_secret_access_key || process.env.R2_SECRET_ACCESS_KEY
    const bucketName = cfg.r2_bucket_name || process.env.R2_BUCKET_NAME
    const publicUrl = cfg.r2_public_url || process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_DOMAIN

    if (accountId && accessKeyId && secretAccessKey && bucketName && publicUrl) {
        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
        })
        const key = `workflow-audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'audio/mpeg',
        }))
        return `${publicUrl.replace(/\/$/, '')}/${key}`
    }

    const fileName = `workflow-audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
    const { error } = await supabase.storage
        .from('audio')
        .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('audio').getPublicUrl(fileName)
    if (!data?.publicUrl) throw new Error('Não foi possível publicar o áudio gerado.')
    return data.publicUrl
}

export async function generateWorkflowElevenLabsAudioUrl(text: string, voiceId?: string | null): Promise<string> {
    const cfg = await loadConfig(['elevenlabs_api_key', 'whatsapp_tts_voice', 'openai_api_key'])
    const apiKey = cfg.elevenlabs_api_key
    const selectedVoice = String(voiceId || cfg.whatsapp_tts_voice || '').trim()

    const spokenText = normalizeTextForWorkflowTTS(text)
    if (!spokenText) throw new Error('Texto do áudio vazio.')

    const openaiFallback = async () => {
        if (!cfg.openai_api_key) return null
        const voice = selectedVoice.startsWith('openai:')
            ? selectedVoice.replace('openai:', '').trim() || 'onyx'
            : 'onyx'
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.openai_api_key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: spokenText,
                voice,
                response_format: 'mp3',
            }),
        })
        if (!res.ok) {
            const err = await res.text().catch(() => '')
            throw new Error(`Falha OpenAI TTS: ${res.status}${err ? ` - ${err.slice(0, 180)}` : ''}`)
        }
        return uploadWorkflowAudio(Buffer.from(await res.arrayBuffer()))
    }

    if (selectedVoice.startsWith('openai:') || (!apiKey && cfg.openai_api_key)) {
        const fallbackUrl = await openaiFallback()
        if (fallbackUrl) return fallbackUrl
    }

    if (!apiKey && !cfg.openai_api_key) throw new Error('ElevenLabs/OpenAI TTS não configurado.')
    if (!selectedVoice) {
        const fallbackUrl = await openaiFallback()
        if (fallbackUrl) return fallbackUrl
        throw new Error('Selecione uma voz ElevenLabs para o áudio.')
    }

    if (apiKey) {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
                text: spokenText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
            }),
        })

        if (res.ok) {
            return uploadWorkflowAudio(Buffer.from(await res.arrayBuffer()))
        }

        const fallbackUrl = await openaiFallback()
        if (fallbackUrl) return fallbackUrl

        const err = await res.text().catch(() => '')
        throw new Error(`Falha ElevenLabs TTS: ${res.status}${err ? ` - ${err.slice(0, 180)}` : ''}`)
    }

    const fallbackUrl = await openaiFallback()
    if (fallbackUrl) return fallbackUrl
    throw new Error('Não foi possível gerar áudio TTS.')
}
