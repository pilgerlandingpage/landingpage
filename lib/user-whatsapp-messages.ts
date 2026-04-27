export const FIRST_ACCESS_MESSAGE_KEY = 'user_first_access_whatsapp_message'
export const PASSWORD_RESET_MESSAGE_KEY = 'user_password_reset_whatsapp_message'

export const DEFAULT_FIRST_ACCESS_MESSAGE = `Ola {nome}!

Bem-vindo(a) a {empresa}!
Seu acesso ao painel administrativo da empresa foi criado.
Para definir sua senha de primeiro acesso, use este link:
{link}

Depois de definir a senha, voce sera direcionado(a) para a tela de login.

Se voce nao reconhece este cadastro, ignore esta mensagem.`

export const DEFAULT_PASSWORD_RESET_MESSAGE = `Ola {nome}!

Recebemos um pedido de redefinicao de senha do painel {empresa}.
Para criar uma nova senha com seguranca, use este link:
{link}

Se voce nao solicitou esta alteracao, ignore esta mensagem.`

type UserMessageParams = {
    name?: string | null
    email?: string | null
    phone?: string | null
    link: string
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

function renderTemplate(template: string, params: UserMessageParams & { companyName: string }) {
    const safeName = String(params.name || '').trim() || 'tudo bem'
    const values: Record<string, string> = {
        nome: safeName,
        name: safeName,
        email: String(params.email || '').trim(),
        telefone: String(params.phone || '').trim(),
        phone: String(params.phone || '').trim(),
        link: params.link,
        empresa: params.companyName,
        company: params.companyName,
    }

    return Object.entries(values).reduce(
        (message, [token, value]) => replaceToken(message, token, value),
        template
    )
}

export async function buildFirstAccessWhatsAppMessage(admin: any, params: UserMessageParams) {
    const config = await getConfigValues(admin, [FIRST_ACCESS_MESSAGE_KEY, 'agent_company_name'])
    const template = config[FIRST_ACCESS_MESSAGE_KEY]?.trim() || DEFAULT_FIRST_ACCESS_MESSAGE

    return renderTemplate(template, {
        ...params,
        companyName: config.agent_company_name?.trim() || 'Pilger',
    })
}

export async function buildPasswordResetWhatsAppMessage(admin: any, params: UserMessageParams) {
    const config = await getConfigValues(admin, [PASSWORD_RESET_MESSAGE_KEY, 'agent_company_name'])
    const template = config[PASSWORD_RESET_MESSAGE_KEY]?.trim() || DEFAULT_PASSWORD_RESET_MESSAGE

    return renderTemplate(template, {
        ...params,
        companyName: config.agent_company_name?.trim() || 'Pilger',
    })
}
