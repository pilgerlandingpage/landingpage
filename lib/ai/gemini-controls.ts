type GeminiGenerationConfigOptions = {
    temperature?: number
    maxOutputTokens?: number
    responseMimeType?: string
    disableThinking?: boolean
}

const DEFAULT_MAX_OUTPUT_TOKENS = 900
const MIN_MAX_OUTPUT_TOKENS = 64
const MAX_MAX_OUTPUT_TOKENS = 8192

function envNumber(key: string) {
    const value = Number(process.env[key])
    return Number.isFinite(value) && value > 0 ? value : null
}

function envNonNegativeNumber(key: string, fallback: number) {
    const value = Number(process.env[key])
    return Number.isFinite(value) && value >= 0 ? value : fallback
}

function clampTokenLimit(value: number) {
    return Math.max(MIN_MAX_OUTPUT_TOKENS, Math.min(MAX_MAX_OUTPUT_TOKENS, Math.round(value)))
}

function supportsThinkingBudget(modelName: string) {
    return /gemini-2\.5-flash(?:-lite)?/i.test(modelName)
}

export function buildGeminiGenerationConfig(
    modelName: string,
    options: GeminiGenerationConfigOptions = {}
) {
    const maxOutputTokens = envNumber('GEMINI_MAX_OUTPUT_TOKENS')
        || options.maxOutputTokens
        || DEFAULT_MAX_OUTPUT_TOKENS
    const config: Record<string, unknown> = {
        maxOutputTokens: clampTokenLimit(maxOutputTokens),
    }

    if (typeof options.temperature === 'number') {
        config.temperature = options.temperature
    }

    if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType
    }

    if (options.disableThinking !== false && supportsThinkingBudget(modelName)) {
        config.thinkingConfig = { thinkingBudget: envNonNegativeNumber('GEMINI_THINKING_BUDGET', 0) }
    }

    return config
}
