import { NextRequest, NextResponse } from 'next/server'
import { appendMetaConnectionLog } from '@/lib/social/meta-oauth'
import { testEditorialImageProvider } from '@/lib/media/editorial-image-providers'
import { testGoogleAnalyticsConnection } from '@/lib/analytics/google'
import { GOOGLE_ADS_API_VERSION } from '@/lib/ads/google'

function parseJsonText(text: string) {
    if (!text) return {}
    try {
        return JSON.parse(text)
    } catch {
        return { message: text }
    }
}

const META_GRAPH_API_VERSION = 'v21.0'

async function getMetaTokenDiagnostics(config: Record<string, string>, accessToken: string) {
    const appId = config.meta_app_id
    const appSecret = config.meta_app_secret
    if (!appId || !appSecret) return null

    try {
        const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/debug_token`)
        url.searchParams.set('input_token', accessToken)
        url.searchParams.set('access_token', `${appId}|${appSecret}`)

        const response = await fetch(url)
        const payload = await response.json()
        if (!response.ok || payload.error) return null

        const scopes = Array.isArray(payload.data?.scopes) ? payload.data.scopes as string[] : []
        const hasAdsPermission = scopes.includes('ads_read') || scopes.includes('ads_management')

        return {
            isValid: Boolean(payload.data?.is_valid),
            hasAdsPermission,
            missingAdsPermission: !hasAdsPermission,
        }
    } catch {
        return null
    }
}

export async function POST(request: NextRequest) {
    try {
        const { service, config } = await request.json()

        switch (service) {
            case 'connectyhub':
            case 'uazapi': {
                const baseUrl = String(config.connectyhub_api_url || '').replace(/\/+$/, '')
                const apiToken = config.connectyhub_api_token

                if (!baseUrl || !apiToken) {
                    return NextResponse.json({
                        success: false,
                        message: 'Preencha CONNECTYHUB_API_URL e CONNECTYHUB_API_TOKEN',
                    })
                }

                try {
                    const res = await fetch(`${baseUrl}/instances`, {
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json',
                        },
                    })

                    if (!res.ok) {
                        const text = await res.text()
                        return NextResponse.json({
                            success: false,
                            message: `Erro ${res.status}: ${text.slice(0, 200)}`,
                        })
                    }

                    const data = await res.json()
                    const instances = Array.isArray(data) ? data : (data?.instances || [])
                    return NextResponse.json({
                        success: true,
                        message: `ConnectyHub conectada. ${instances.length} instancia(s) encontrada(s).`,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro ao conectar: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'gemini': {
                const apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY
                const model = config.gemini_model || 'gemini-2.5-flash'

                if (!apiKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'API Key do Gemini não configurada',
                    })
                }

                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }],
                            generationConfig: { temperature: 0, maxOutputTokens: 10 },
                        }),
                    }
                )

                if (!res.ok) {
                    const text = await res.text()
                    return NextResponse.json({
                        success: false,
                        message: `Erro ${res.status}: ${text.slice(0, 100)}`,
                    })
                }

                return NextResponse.json({
                    success: true,
                    message: `API Gemini funcionando! Modelo: ${model}`,
                })
            }

            case 'vapid': {
                const subject = config.vapid_subject || process.env.VAPID_SUBJECT
                const publicKey = config.vapid_public_key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                const privateKey = config.vapid_private_key || process.env.VAPID_PRIVATE_KEY

                if (!subject || !publicKey || !privateKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'Preencha todos os campos (Subject, Public Key, Private Key)',
                    })
                }

                // Validate format
                if (!subject.startsWith('mailto:')) {
                    return NextResponse.json({
                        success: false,
                        message: 'Subject deve começar com "mailto:"',
                    })
                }

                if (publicKey.length < 40 || privateKey.length < 20) {
                    return NextResponse.json({
                        success: false,
                        message: 'Formato das chaves VAPID parecem inválidos',
                    })
                }

                // Try to import web-push and validate keys
                try {
                    const webpush = await import('web-push')
                    webpush.default.setVapidDetails(subject, publicKey, privateKey)
                    return NextResponse.json({
                        success: true,
                        message: 'Chaves VAPID válidas e configuradas!',
                    })
                } catch (err) {
                    return NextResponse.json({
                        success: false,
                        message: `Chaves VAPID inválidas: ${String(err).slice(0, 100)}`,
                    })
                }
            }

            case 'openai': {
                const apiKey = config.openai_api_key
                const model = config.openai_model || 'gpt-3.5-turbo'

                if (!apiKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'API Key da OpenAI não configurada',
                    })
                }

                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: 'Say OK' }],
                        max_tokens: 5
                    })
                })

                if (!res.ok) {
                    const error = await res.json()
                    return NextResponse.json({
                        success: false,
                        message: `Erro OpenAI: ${error.error?.message || res.statusText}`,
                    })
                }

                return NextResponse.json({
                    success: true,
                    message: `OpenAI Conectada! Modelo: ${model}`,
                })
            }

            case 'meta_ads': {
                const accessToken = config.meta_access_token
                const rawAdAccountId = String(config.meta_ad_account_id || '').trim()
                const adAccountId = rawAdAccountId && rawAdAccountId.startsWith('act_')
                    ? rawAdAccountId
                    : rawAdAccountId ? `act_${rawAdAccountId}` : ''

                if (!accessToken) {
                    await appendMetaConnectionLog({
                        provider: 'meta',
                        action: 'test_connection',
                        status: 'error',
                        message: 'Teste Meta falhou: Access Token nao configurado.',
                    })
                    return NextResponse.json({
                        success: false,
                        message: 'Access Token do Meta Ads não configurado',
                    })
                }

                const tokenDiagnostics = await getMetaTokenDiagnostics(config, accessToken)
                if (tokenDiagnostics?.isValid && tokenDiagnostics.missingAdsPermission) {
                    const message = 'Token Meta valido, mas sem permissao de anuncios. Gere um novo token do usuario de sistema com ads_read e/ou ads_management e atribua a conta de anuncios ao usuario.'
                    await appendMetaConnectionLog({
                        provider: 'meta',
                        action: 'test_connection',
                        status: 'error',
                        message: `Teste Meta falhou: ${message}`,
                    })
                    return NextResponse.json({ success: false, message })
                }

                // If Ad Account ID is missing, we just test the token identity.
                const targetUrl = new URL(adAccountId
                    ? `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${adAccountId}`
                    : `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me`)
                targetUrl.searchParams.set('access_token', accessToken)
                targetUrl.searchParams.set('fields', adAccountId ? 'name,account_status' : 'id,name')

                try {
                    const res = await fetch(targetUrl)

                    if (!res.ok) {
                        const error = await res.json()
                        const baseMessage = error.error?.message || res.statusText
                        const permissionMessage = String(baseMessage).includes('ads_management or ads_read permission')
                            ? 'A Meta recusou a conta de anuncios porque o token nao tem ads_read/ads_management para essa conta. Revise as permissoes do usuario de sistema e a atribuicao da conta de anuncios.'
                            : baseMessage
                        await appendMetaConnectionLog({
                            provider: 'meta',
                            action: 'test_connection',
                            status: 'error',
                            message: `Teste Meta falhou: ${permissionMessage}`,
                        })
                        return NextResponse.json({
                            success: false,
                            message: `Erro Meta Ads: ${permissionMessage}`,
                        })
                    }

                    const data = await res.json()

                    if (adAccountId) {
                        const statusName = data.account_status === 1 ? 'Ativa' :
                            data.account_status === 2 ? 'Desativada' :
                                data.account_status === 3 ? 'Unsettled' :
                                    data.account_status === 7 ? 'Pendente de Revisão' :
                                        data.account_status === 101 ? 'Fechada' :
                                            `Status ${data.account_status}`
                        const message = `Conectado! Conta: ${data.name || adAccountId} (${statusName})`
                        await appendMetaConnectionLog({
                            provider: 'meta',
                            action: 'test_connection',
                            status: 'success',
                            message,
                        })
                        return NextResponse.json({
                            success: true,
                            message,
                        })
                    }

                    await appendMetaConnectionLog({
                        provider: 'meta',
                        action: 'test_connection',
                        status: 'success',
                        message: `Token valido. Conectado como: ${data.name || data.id}`,
                    })
                    return NextResponse.json({
                        success: true,
                        message: `Token válido! Conectado como: ${data.name || data.id}`,
                    })

                } catch (e) {
                    await appendMetaConnectionLog({
                        provider: 'meta',
                        action: 'test_connection',
                        status: 'error',
                        message: `Erro ao conectar com Meta Ads: ${e instanceof Error ? e.message : String(e)}`,
                    })
                    return NextResponse.json({
                        success: false,
                        message: `Erro ao conectar com Meta Ads: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'google_ads': {
                const developerToken = (config.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN)?.trim()
                const clientId = (config.google_ads_client_id || process.env.GOOGLE_ADS_CLIENT_ID)?.trim()
                const clientSecret = (config.google_ads_client_secret || process.env.GOOGLE_ADS_CLIENT_SECRET)?.trim()
                const refreshToken = (config.google_ads_refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN)?.trim()

                let managerId = (config.google_ads_manager_id || process.env.GOOGLE_ADS_MANAGER_ID)?.trim()
                const customerId = (config.google_ads_customer_id || process.env.GOOGLE_ADS_CUSTOMER_ID)?.trim()

                // Limpeza de hifens
                const cleanId = (id?: string) => id ? id.replace(/-/g, '') : undefined;
                const cleanManagerId = cleanId(managerId);
                const cleanCustomerId = cleanId(customerId);

                if (!developerToken || !clientId || !clientSecret || !refreshToken || !cleanCustomerId || !cleanManagerId) {
                    return NextResponse.json({
                        success: false,
                        message: 'Preencha todos os campos do Google Ads (incluindo as 4 chaves OAuth e os 2 IDs de conta).',
                    })
                }

                try {
                    // 1. Obter Access Token via Refresh Token
                    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            client_id: clientId,
                            client_secret: clientSecret,
                            refresh_token: refreshToken,
                            grant_type: 'refresh_token'
                        })
                    })

                    const tokenText = await tokenRes.text()
                    let tokenData: any
                    try {
                        tokenData = JSON.parse(tokenText)
                    } catch (e) {
                        return NextResponse.json({
                            success: false,
                            message: `Erro na resposta do Google OAuth (${tokenRes.status}). Resposta não é JSON.`
                        })
                    }

                    if (!tokenRes.ok || tokenData.error) {
                        return NextResponse.json({
                            success: false,
                            message: `Erro OAuth Google (${tokenRes.status}): ${tokenData.error_description || tokenData.error || 'Token inválido'}`
                        })
                    }

                    const accessToken = tokenData.access_token

                    // 2. Testar chamada à API
                    const apiUrl = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`
                    console.log('Testando conexão Google Ads URL:', apiUrl)

                    const apiRes = await fetch(
                        apiUrl,
                        {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'developer-token': developerToken,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            }
                        }
                    )

                    const apiText = await apiRes.text()
                    let apiData: any
                    try {
                        apiData = JSON.parse(apiText)
                    } catch (e) {
                        return NextResponse.json({
                            success: false,
                            message: `Erro na resposta da API Google Ads (${apiRes.status}). URL: ${apiUrl}. Resposta: ${apiText.substring(0, 100)}...`
                        })
                    }

                    if (!apiRes.ok || apiData.error) {
                        const errorObj = apiData.error
                        const errMsg = errorObj?.message || 'Erro desconhecido'
                        
                        // Check for specific Google Ads error codes
                        const adsErrors = errorObj?.details?.find((d: any) => d['@type']?.includes('GoogleAdsFailure'))?.errors || []
                        const specificError = adsErrors[0]?.errorCode ? Object.entries(adsErrors[0].errorCode)[0] : null
                        const specificMsg = specificError ? `[${specificError[0]}: ${specificError[1]}] ` : ''
                        const detailMsg = adsErrors[0]?.message || ''

                        return NextResponse.json({
                            success: false,
                            message: `Autenticado, mas a API negou (${apiRes.status}): ${specificMsg}${detailMsg || errMsg}`
                        })
                    }

                    const resourceNames = apiData.resourceNames || []
                    return NextResponse.json({
                        success: true,
                        message: `Conectado com sucesso! Você tem acesso a ${resourceNames.length} contas.`
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Falha na conexão: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'google_analytics': {
                try {
                    const result = await testGoogleAnalyticsConnection(config || {})
                    return NextResponse.json(result)
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro ao conectar com Google Analytics: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'serpapi': {
                const apiKey = config.serpapi_api_key

                if (!apiKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'API Key do SerpApi não configurada',
                    })
                }

                try {
                    const res = await fetch(`https://serpapi.com/account?api_key=${apiKey}`)
                    if (!res.ok) {
                        const error = await res.json().catch(() => ({ error: 'Desconhecido' }))
                        return NextResponse.json({
                            success: false,
                            message: `Erro SerpApi: ${error.error || res.statusText}`,
                        })
                    }

                    const data = await res.json()
                    return NextResponse.json({
                        success: true,
                        message: `Conectado! Conta: ${data.account_email || 'Válida'} (${data.plan_searches_left} buscas restantes)`,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro na conexão: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'dataforseo': {
                const login = config.dataforseo_login
                const password = config.dataforseo_password

                if (!login || !password) {
                    return NextResponse.json({
                        success: false,
                        message: 'Preencha Login e Password (API Key) do DataForSEO',
                    })
                }

                try {
                    // Endpoint oficial para info da conta no DataForSEO
                    const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
                        }
                    })

                    if (!res.ok) {
                        const error = await res.json().catch(() => ({ status_message: 'Desconhecido' }))
                        return NextResponse.json({
                            success: false,
                            message: `Erro DataForSEO: ${error.status_message || res.statusText}`,
                        })
                    }

                    const data = await res.json()
                    const tasks = data?.tasks || []
                    if (tasks.length > 0 && tasks[0].result && tasks[0].result.length > 0) {
                        const balance = tasks[0].result[0].money?.balance || 0
                        return NextResponse.json({
                            success: true,
                            message: `Conectado com sucesso! Saldo: $${balance.toFixed(2)}`,
                        })
                    }

                    return NextResponse.json({
                        success: true,
                        message: 'Conectado com sucesso com DataForSEO!',
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro na conexão: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'brevo': {
                const apiKey = (config.brevo_api_key || process.env.BREVO_API_KEY || '').trim()
                const senderName = (config.brevo_sender_name || process.env.BREVO_SENDER_NAME || 'Guilherme Pilger').trim()
                const senderEmail = (config.brevo_sender_email || process.env.BREVO_SENDER_EMAIL || '').trim()
                const replyToEmail = (config.brevo_reply_to_email || process.env.BREVO_REPLY_TO_EMAIL || '').trim()
                const testRecipient = (config.brevo_test_recipient || process.env.BREVO_TEST_RECIPIENT || '').trim()

                if (!apiKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'API Key da Brevo nao configurada',
                    })
                }

                if (!senderEmail) {
                    return NextResponse.json({
                        success: false,
                        message: 'Informe um e-mail de remetente validado na Brevo',
                    })
                }

                try {
                    const accountRes = await fetch('https://api.brevo.com/v3/account', {
                        headers: {
                            accept: 'application/json',
                            'api-key': apiKey,
                        },
                    })

                    const accountText = await accountRes.text()
                    const accountData = parseJsonText(accountText)

                    if (!accountRes.ok) {
                        return NextResponse.json({
                            success: false,
                            message: `Erro Brevo (${accountRes.status}): ${(accountData?.message || accountData?.error || accountText || accountRes.statusText).slice(0, 180)}`,
                        })
                    }

                    if (testRecipient) {
                        const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                            method: 'POST',
                            headers: {
                                accept: 'application/json',
                                'api-key': apiKey,
                                'content-type': 'application/json',
                            },
                            body: JSON.stringify({
                                sender: { name: senderName || senderEmail, email: senderEmail },
                                to: [{ email: testRecipient }],
                                replyTo: replyToEmail ? { email: replyToEmail } : undefined,
                                subject: 'Teste de integracao Brevo - Pilger CRM',
                                htmlContent: '<p>Integracao Brevo conectada com sucesso.</p>',
                                textContent: 'Integracao Brevo conectada com sucesso.',
                            }),
                        })

                        const sendText = await sendRes.text()
                        const sendData = parseJsonText(sendText)

                        if (!sendRes.ok) {
                            return NextResponse.json({
                                success: false,
                                message: `Conta Brevo valida, mas envio falhou (${sendRes.status}): ${(sendData?.message || sendData?.error || sendText || sendRes.statusText).slice(0, 180)}`,
                            })
                        }

                        return NextResponse.json({
                            success: true,
                            message: `Brevo conectado. E-mail de teste enviado para ${testRecipient}.`,
                        })
                    }

                    return NextResponse.json({
                        success: true,
                        message: `Brevo conectado! Conta: ${accountData.email || accountData.companyName || 'valida'}.`,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro na conexao Brevo: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }
            case 'pexels': {
                try {
                    const result = await testEditorialImageProvider('pexels', config)
                    return NextResponse.json({
                        success: true,
                        message: `Pexels conectado. ${result.count} imagem(ns) retornada(s) no teste editorial.`,
                        sample: result.sample,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro Pexels: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'pixabay': {
                try {
                    const result = await testEditorialImageProvider('pixabay', config)
                    return NextResponse.json({
                        success: true,
                        message: `Pixabay conectado. ${result.count} imagem(ns) retornada(s) no teste editorial.`,
                        sample: result.sample,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro Pixabay: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }
            case 'cloudflare': {
                const accountId = config.r2_account_id
                const accessKeyId = config.r2_access_key_id
                const secretAccessKey = config.r2_secret_access_key
                const bucketName = config.r2_bucket_name

                if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
                    return NextResponse.json({
                        success: false,
                        message: 'Preencha Account ID, Access Key ID, Secret Access Key e Bucket Name',
                    })
                }

                try {
                    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3')
                    
                    const s3 = new S3Client({
                        region: 'auto',
                        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
                        credentials: {
                            accessKeyId,
                            secretAccessKey,
                        },
                    })

                    const command = new HeadBucketCommand({ Bucket: bucketName })
                    await s3.send(command)

                    return NextResponse.json({
                        success: true,
                        message: `Conectado com sucesso ao bucket: ${bucketName}`,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro na conexão ao bucket: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'inngest': {
                const eventKey = config.inngest_event_key || process.env.INNGEST_EVENT_KEY
                const signingKey = config.inngest_signing_key || process.env.INNGEST_SIGNING_KEY

                if (!eventKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'Event Key do Inngest não configurada',
                    })
                }

                if (!signingKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'Signing Key do Inngest não configurada',
                    })
                }

                try {
                    // Test the Event Key by sending a test event to Inngest
                    const res = await fetch('https://inn.gs/e/' + eventKey, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: 'test/connection',
                            data: { test: true, timestamp: new Date().toISOString() },
                        }),
                    })

                    if (!res.ok) {
                        const text = await res.text()
                        return NextResponse.json({
                            success: false,
                            message: `Erro Inngest (${res.status}): ${text.slice(0, 100)}`,
                        })
                    }

                    return NextResponse.json({
                        success: true,
                        message: `Inngest Conectado! Event Key válida. Signing Key: ${signingKey.slice(0, 15)}...`,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro na conexão: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }

            case 'elevenlabs': {
                const apiKey = config.elevenlabs_api_key

                if (!apiKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'API Key da ElevenLabs não configurada',
                    })
                }

                try {
                    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
                        headers: { 'xi-api-key': apiKey }
                    })

                    if (!res.ok) {
                        const text = await res.text()
                        return NextResponse.json({
                            success: false,
                            message: `Erro ElevenLabs (${res.status}): ${text.slice(0, 150)}`,
                        })
                    }

                    const data = await res.json()
                    const voices = data.voices || []
                    const cloned = voices.filter((v: any) => v.category === 'cloned').length
                    return NextResponse.json({
                        success: true,
                        message: `Conectado! ${voices.length} vozes disponíveis${cloned > 0 ? ` (${cloned} clonada${cloned > 1 ? 's' : ''})` : ''}.`,
                    })
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        message: `Erro na conexão: ${e instanceof Error ? e.message : String(e)}`,
                    })
                }
            }
            default:
                return NextResponse.json({
                    success: false,
                    message: `Serviço desconhecido: ${service}`,
                })
        }
    } catch (error) {
        console.error('Test integration error:', error)
        return NextResponse.json({
            success: false,
            message: `Erro interno ao testar conexão: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
