import { spawn } from 'node:child_process'

const scope = process.argv.includes('--scope')
    ? process.argv[process.argv.indexOf('--scope') + 1]
    : 'pilger-landing-pages-projects'
const intervalMs = Number(process.env.MONITOR_INTERVAL_MS || 60_000)

const counters = new Map()
let total = 0
let reconnects = 0

function keyFor(event) {
    const source = event.source || 'unknown'
    const method = event.requestMethod || '-'
    const status = event.responseStatusCode || '-'
    const path = event.requestPath || event.path || '(no path)'
    return `${source} ${method} ${status} ${path}`
}

function bump(event) {
    total += 1
    const key = keyFor(event)
    counters.set(key, (counters.get(key) || 0) + 1)
}

function printSummary() {
    const now = new Date().toLocaleTimeString()
    const rows = [...counters.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)

    console.log(`\n[${now}] ${total} eventos desde o inicio | top rotas no ultimo intervalo:`)
    if (rows.length === 0) {
        console.log('  sem eventos novos')
    } else {
        for (const [key, count] of rows) {
            console.log(`  ${String(count).padStart(4, ' ')}  ${key}`)
        }
    }
    counters.clear()
}

function start() {
    reconnects += 1
    console.log(`\nConectando aos logs da Vercel (tentativa ${reconnects})...`)

    const child = spawn(
        'vercel',
        [
            'logs',
            '--follow',
            '--json',
            '--environment',
            'production',
            '--scope',
            scope,
            '--no-branch',
        ],
        {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        }
    )

    let stdoutBuffer = ''
    child.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk.toString()
        const lines = stdoutBuffer.split(/\r?\n/)
        stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('{')) continue
            try {
                bump(JSON.parse(trimmed))
            } catch {
                // Non-JSON progress output can occasionally appear even with --json.
            }
        }
    })

    child.stderr.on('data', (chunk) => {
        const text = chunk.toString().trim()
        if (text) console.error(text)
    })

    child.on('exit', () => {
        setTimeout(start, 2_000)
    })
}

setInterval(printSummary, intervalMs)
start()
