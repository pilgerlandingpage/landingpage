export const FIRST_ACCESS_MESSAGE_KEY = 'user_first_access_whatsapp_message'
export const PASSWORD_RESET_MESSAGE_KEY = 'user_password_reset_whatsapp_message'
export const USER_ACCESS_EXTRA_BUTTONS_KEY = 'user_access_extra_buttons'
export const ACCESS_LINK_BUTTON_TAG = '{botao_link}'

export const DEFAULT_FIRST_ACCESS_MESSAGE = `Ola {nome}!

Bem-vindo(a) a {empresa}!
Seu acesso ao painel administrativo da empresa foi criado.
Para definir sua senha de primeiro acesso com seguranca, toque no botao abaixo:
{botao_link}

Depois de definir a senha, voce sera direcionado(a) para a tela de login.

Se voce nao reconhece este cadastro, ignore esta mensagem.`

export const DEFAULT_PASSWORD_RESET_MESSAGE = `Ola {nome}!

Recebemos um pedido de redefinicao de senha do painel {empresa}.
Para criar uma nova senha com seguranca, toque no botao abaixo:
{botao_link}

Se voce nao solicitou esta alteracao, ignore esta mensagem.`

type UserMessageParams = {
    name?: string | null
    email?: string | null
    phone?: string | null
    link: string
}

export type UserAccessWhatsAppButton = {
    text: string
    url: string
}

export type UserAccessWhatsAppPayload = {
    text: string
    buttons: UserAccessWhatsAppButton[]
}

type ConfiguredExtraButton = {
    name?: string
    tag?: string
    url?: string
}

async function getConfigValues(admin: any, keys: string[]) {
    const { data, error } = await admin
        .from('app_config')
        .select('key, value')
        .in('key', keys)

    if (error) throw error

    const values: Record<string, string> = {}
    for (const row of data || []) {
        values[row.key] = String(row.value || '')
    }
    return values
}

function replaceToken(message: string, token: string, value: string) {
    return message
        .replaceAll(`{${token}}`, value)
        .replaceAll(`{{${token}}}`, value)
}

function replaceTag(message: string, tag: string, value: string) {
    const token = tag.replace(/[{}]/g, '')
    return replaceToken(message, token, value)
}

function parseExtraButtons(raw: string | undefined): ConfiguredExtraButton[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []

        return parsed
            .map((button: any) => ({
                name: String(button?.name || '').trim(),
                tag: String(button?.tag || '').trim(),
                url: String(button?.url || '').trim(),
            }))
            .filter(button => button.name && button.tag && /^https?:\/\//i.test(button.url || ''))
    } catch {
        return []
    }
}

function normalizeRenderedMessage(message: string) {
    return message
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function renderTemplate(
    template: string,
    params: UserMessageParams & {
        companyName: string
        accessButtonLabel: string
        extraButtons?: ConfiguredExtraButton[]
    }
): UserAccessWhatsAppPayload {
    const safeName = String(params.name || '').trim() || 'tudo bem'
    const values: Record<string, string> = {
        nome: safeName,
        name: safeName,
        email: String(params.email || '').trim(),
        telefone: String(params.phone || '').trim(),
        phone: String(params.phone || '').trim(),
        link: '',
        botao_link: '',
        empresa: params.companyName,
        company: params.companyName,
    }

    let message = Object.entries(values).reduce(
        (message, [token, value]) => replaceToken(message, token, value),
        template
    )

    const buttons: UserAccessWhatsAppButton[] = [{
        text: params.accessButtonLabel,
        url: params.link,
    }]

    for (const button of params.extraButtons || []) {
        if (!button.tag || !button.name || !button.url) continue
        if (!message.includes(button.tag)) continue

        message = replaceTag(message, button.tag, '')
        buttons.push({
            text: button.name.substring(0, 20),
            url: button.url,
        })
    }

    return {
        text: normalizeRenderedMessage(message),
        buttons: buttons.slice(0, 4),
    }
}

export async function buildFirstAccessWhatsAppMessage(admin: any, params: UserMessageParams) {
    const config = await getConfigValues(admin, [FIRST_ACCESS_MESSAGE_KEY, USER_ACCESS_EXTRA_BUTTONS_KEY, 'agent_company_name'])
    const template = config[FIRST_ACCESS_MESSAGE_KEY]?.trim() || DEFAULT_FIRST_ACCESS_MESSAGE

    return renderTemplate(template, {
        ...params,
        companyName: config.agent_company_name?.trim() || 'Pilger',
        accessButtonLabel: 'Definir senha',
        extraButtons: parseExtraButtons(config[USER_ACCESS_EXTRA_BUTTONS_KEY]),
    })
}

export async function buildPasswordResetWhatsAppMessage(admin: any, params: UserMessageParams) {
    const config = await getConfigValues(admin, [PASSWORD_RESET_MESSAGE_KEY, USER_ACCESS_EXTRA_BUTTONS_KEY, 'agent_company_name'])
    const template = config[PASSWORD_RESET_MESSAGE_KEY]?.trim() || DEFAULT_PASSWORD_RESET_MESSAGE

    return renderTemplate(template, {
        ...params,
        companyName: config.agent_company_name?.trim() || 'Pilger',
        accessButtonLabel: 'Redefinir senha',
        extraButtons: parseExtraButtons(config[USER_ACCESS_EXTRA_BUTTONS_KEY]),
    })
}
