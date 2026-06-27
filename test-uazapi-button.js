require('dotenv').config({ path: '.env.local' })

function requiredEnv(name) {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`Configure ${name} no ambiente antes de rodar este teste.`)
    }
    return value
}

async function sendMenu(baseUrl, apiToken, instanceId, payload) {
    const response = await fetch(`${baseUrl}/provider/send/menu`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
            instanceId,
            payload,
        }),
    })

    console.log(payload.text, response.status, await response.text())
}

async function check() {
    const baseUrl = requiredEnv('CONNECTYHUB_API_URL').replace(/\/+$/, '')
    const apiToken = requiredEnv('CONNECTYHUB_API_TOKEN')
    const instanceId = requiredEnv('CONNECTYHUB_INSTANCE_ID')
    const number = requiredEnv('WHATSAPP_TEST_NUMBER')

    console.log(`Testando envio via ConnectyHub na instancia ${instanceId.slice(0, 8)}...`)

    await sendMenu(baseUrl, apiToken, instanceId, {
        number,
        type: 'button',
        text: 'Teste btn 1',
        choices: ['Abrir|url:https://google.com'],
    })

    await sendMenu(baseUrl, apiToken, instanceId, {
        number,
        type: 'button',
        text: 'Teste btn 2 sem prefixo url:',
        choices: ['Abrir o Link|https://google.com'],
    })

    await sendMenu(baseUrl, apiToken, instanceId, {
        number,
        type: 'button',
        text: 'Teste btn 3 multiplos',
        choices: ['Site1|https://google.com', 'Site2|https://bing.com'],
    })

    await sendMenu(baseUrl, apiToken, instanceId, {
        number,
        type: 'button',
        text: 'Teste 4 url e call e reply',
        choices: ['Sim|sim', 'Ligar|call:551199999999', 'Link|https://google.com'],
    })
}

check().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
