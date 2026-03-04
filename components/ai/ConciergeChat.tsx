'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Send, X, Loader2, User, Search, Mic, Square } from 'lucide-react'

// Helper to read cookie value (Tracker sets pilger_visitor_id as cookie, NOT localStorage)
import { trackEvent, getVisitorId } from '@/lib/tracking/client'
import { playSentSound, playReceivedSound } from '@/lib/sounds'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    audioUrl?: string
    audioDuration?: number
}

// Scrape visible page content from the DOM for AI context
function scrapePageContent(): string {
    try {
        const parts: string[] = []

        // Page title
        const title = document.title
        if (title) parts.push(`Título da página: ${title}`)

        // H1
        const h1 = document.querySelector('h1')
        if (h1?.textContent) parts.push(`Título principal: ${h1.textContent.trim()}`)

        // H2s (first 3)
        const h2s = document.querySelectorAll('h2')
        const h2Texts: string[] = []
        h2s.forEach((el, i) => {
            if (i < 3 && el.textContent?.trim()) h2Texts.push(el.textContent.trim())
        })
        if (h2Texts.length > 0) parts.push(`Subtítulos: ${h2Texts.join(' | ')}`)

        // Price (common patterns)
        const priceEl = document.querySelector('[data-price], .price, .property-price, .prop-price')
        if (priceEl?.textContent) parts.push(`Preço: ${priceEl.textContent.trim()}`)

        // Also look for R$ in text
        if (!priceEl) {
            const allText = document.body.innerText
            const priceMatch = allText.match(/R\$\s*[\d.,]+/)
            if (priceMatch) parts.push(`Preço encontrado: ${priceMatch[0]}`)
        }

        // Location
        const locationEl = document.querySelector('[data-location], .location, .property-location')
        if (locationEl?.textContent) parts.push(`Localização: ${locationEl.textContent.trim()}`)

        // Description (first 300 chars)
        const descEl = document.querySelector('[data-description], .description, .property-description, meta[name="description"]')
        if (descEl) {
            const text = descEl instanceof HTMLMetaElement ? descEl.content : descEl.textContent
            if (text?.trim()) parts.push(`Descrição: ${text.trim().substring(0, 300)}`)
        }

        // Features/amenities
        const featureEls = document.querySelectorAll('[data-feature], .feature, .amenity, .stat')
        const features: string[] = []
        featureEls.forEach((el, i) => {
            if (i < 8 && el.textContent?.trim()) features.push(el.textContent.trim())
        })
        if (features.length > 0) parts.push(`Características: ${features.join(', ')}`)

        // Check for cloned landing page
        const isCloned = document.querySelector('[data-cloned="true"]') !== null
        if (isCloned) parts.push(`Tipo: Landing Page Clonada`)

        // Meta description fallback
        if (parts.length <= 2) {
            const metaDesc = document.querySelector('meta[name="description"]')
            if (metaDesc instanceof HTMLMetaElement && metaDesc.content) {
                parts.push(`Meta descrição: ${metaDesc.content}`)
            }
        }

        return parts.join('\n')
    } catch {
        return ''
    }
}

export default function ConciergeChat() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isTyping, setIsTyping] = useState(false) // "digitando..." state
    const [connectionStep, setConnectionStep] = useState<0 | 1 | 2 | 3>(0) // 0=idle, 1=searching, 2=found, 3=connecting
    const [hasGreeted, setHasGreeted] = useState(false)
    const [broker, setBroker] = useState<{ name: string; creci: string; photo_url?: string } | null>(null)
    const [pageContent, setPageContent] = useState('')
    const [timing, setTiming] = useState({ delayBeforeTyping: 2000, typingMinDuration: 5000, typingMaxDuration: 7000, connectionSearchDelay: 1500, connectionFoundDelay: 1000, connectionConnectingDelay: 1200 })
    const [mounted, setMounted] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Detect Context (Home, Property, Landing Page, Cloned LP)
    const [pageContext, setPageContext] = useState<{ type: 'home' | 'property' | 'landing_page' | 'cloned_landing_page'; id?: string; slug?: string }>({ type: 'home' })
    const pathname = usePathname()

    // Don't render on admin pages or login page
    const isExcludedPage = pathname?.startsWith('/admin') || pathname === '/login' || pathname === '/signup'

    useEffect(() => {
        if (!pathname || isExcludedPage) return

        if (pathname === '/' || pathname.startsWith('/busca')) {
            setPageContext({ type: 'home' })
        } else if (pathname.startsWith('/imovel/')) {
            const id = pathname.split('/')[2]
            setPageContext({ type: 'property', id })
        } else if (pathname !== '/favicon.ico') {
            const slug = pathname.substring(1)
            // Check if cloned by looking at DOM after a short delay
            const isCloned = document.querySelector('[data-cloned="true"]') !== null
            setPageContext({ type: isCloned ? 'cloned_landing_page' : 'landing_page', slug })
        }

        // Scrape content after page renders
        const timer = setTimeout(() => {
            const content = scrapePageContent()
            setPageContent(content)
        }, 1500) // Wait for page to fully render

        setMounted(true)

        return () => clearTimeout(timer)
    }, [pathname])

    // Auto-open after admin-configured delay per page type
    useEffect(() => {
        if (isOpen || hasGreeted || isExcludedPage || !pathname) return

        let timerId: ReturnType<typeof setTimeout> | null = null
        let cancelled = false

        // Determine page type for the delay config
        let pageType = 'home'
        if (pathname.startsWith('/imovel/')) pageType = 'property'
        else if (pathname !== '/' && pathname !== '/favicon.ico' && !pathname.startsWith('/busca')) pageType = 'landing_page'

        // Fetch the configured delay for this page type
        fetch(`/api/chat/init?type=${pageType}&delayOnly=true`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return
                const delay = data.autoOpenDelay || 15000
                timerId = setTimeout(() => {
                    setIsOpen(true)
                }, delay)
            })
            .catch(() => {
                if (cancelled) return
                timerId = setTimeout(() => {
                    setIsOpen(true)
                }, 15000)
            })

        return () => {
            cancelled = true
            if (timerId) clearTimeout(timerId)
        }
    }, [pathname, isExcludedPage])

    // Listen for external CTA buttons opening the chat
    useEffect(() => {
        const handleOpenChat = () => {
            setIsOpen(true)
            trackEvent('chat_opened_via_cta')
        }
        window.addEventListener('open-concierge-chat', handleOpenChat)
        return () => window.removeEventListener('open-concierge-chat', handleOpenChat)
    }, [])

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, isOpen, connectionStep, isTyping, scrollToBottom])

    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true)
            setConnectionStep(1) // Step 1: Procurando corretor

            const params = new URLSearchParams()
            params.set('type', pageContext.type)
            if (pageContext.id) params.set('id', pageContext.id)
            if (pageContext.slug) params.set('slug', pageContext.slug)
            if (pageContent) params.set('page_content', pageContent.substring(0, 500))

            fetch(`/api/chat/init?${params.toString()}`)
                .then(res => res.json())
                .then(data => {
                    setBroker(data.broker)
                    if (data.timing) setTiming(data.timing)
                    const initTiming = data.timing || timing

                    // Step 2: Corretor encontrado!
                    setTimeout(() => {
                        setConnectionStep(2)

                        // Step 3: Conectando...
                        setTimeout(() => {
                            setConnectionStep(3)

                            // Done: show typing then greeting
                            setTimeout(() => {
                                setConnectionStep(0)
                                setIsTyping(true)
                                setTimeout(() => {
                                    setIsTyping(false)
                                    playReceivedSound()
                                    setMessages([{
                                        id: 'init',
                                        role: 'assistant',
                                        content: data.greeting || 'Olá! Como posso te ajudar hoje?'
                                    }])
                                }, initTiming.delayBeforeTyping)
                            }, initTiming.connectionConnectingDelay || 1200)
                        }, initTiming.connectionFoundDelay || 1000)
                    }, initTiming.connectionSearchDelay || 1500)
                })
                .catch(() => {
                    setConnectionStep(0)
                    setMessages([{
                        id: 'init',
                        role: 'assistant',
                        content: 'Olá! Sou corretor da Pilger. Como posso ajudar você hoje?'
                    }])
                })
        }
    }, [isOpen, hasGreeted, pageContext, pageContent])



    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
        playSentSound()
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        // Track message sent
        trackEvent('message_sent', { message_length: userMsg.content.length })

        try {
            const currentContext = {
                type: pageContext.type,
                id: pageContext.id,
                slug: pageContext.slug,
                url: window.location.href
            }

            // Start API call immediately (runs in background)
            const apiPromise = fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.content,
                    history: messages,
                    broker: broker,
                    page_context: currentContext,
                    page_content: pageContent,
                    propertyId: pageContext.type === 'property' ? pageContext.id : null,
                    visitor_cookie_id: getVisitorId() // Use shared client logic
                })
            }).then(res => res.json())

            // Stage 1: Wait (silence — like reading the message)
            await new Promise(resolve => setTimeout(resolve, timing.delayBeforeTyping))

            // Stage 2: Show "digitando..." for configured duration (random human-like delay)
            setIsTyping(true)
            const typingRange = timing.typingMaxDuration - timing.typingMinDuration
            const typingDuration = timing.typingMinDuration + Math.random() * typingRange

            // Wait for BOTH: typing duration AND API response
            const [data] = await Promise.all([
                apiPromise,
                new Promise(resolve => setTimeout(resolve, typingDuration))
            ])

            // Stage 3: Show the response
            setIsTyping(false)
            if (data.response) {
                playReceivedSound()
                const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response }
                setMessages(prev => [...prev, aiMsg])
            }

        } catch (error: any) {
            console.error(error)
            setIsTyping(false)
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Desculpe, estou com um probleminha. Pode repetir?'
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Voice recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

            // Pick a supported MIME type — webm preferred, fall back to mp4/ogg/default
            let mimeType = 'audio/webm'
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
                else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg'
                else mimeType = '' // let browser pick default
            }

            const mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop())
                const actualMime = mediaRecorder.mimeType || 'audio/webm'
                const audioBlob = new Blob(audioChunksRef.current, { type: actualMime })
                if (audioBlob.size < 1000) return // Too short, ignore

                const duration = recordingTime
                const msgId = Date.now().toString()

                // Show loading bubble immediately
                const audioMsg: Message = {
                    id: msgId,
                    role: 'user',
                    content: '🎤 Mensagem de voz',
                    audioUrl: '', // Will be updated once uploaded
                    audioDuration: duration,
                }
                playSentSound()
                setMessages(prev => [...prev, audioMsg])
                setIsLoading(true)

                try {
                    const ext = actualMime.includes('mp4') ? 'mp4' : actualMime.includes('ogg') ? 'ogg' : 'webm'

                    // Step 1 & 2: Upload to R2 AND transcribe in PARALLEL
                    // Transcription uses the raw blob directly (not R2 URL) to avoid content-type issues
                    const uploadFormData = new FormData()
                    uploadFormData.append('file', audioBlob, `voice-${msgId}.${ext}`)
                    uploadFormData.append('folder', 'voice-messages')

                    const transcribeFormData = new FormData()
                    transcribeFormData.append('audio', audioBlob, `voice.${ext}`)

                    const [uploadRes, transcribeRes] = await Promise.all([
                        fetch('/api/upload', { method: 'POST', body: uploadFormData }),
                        fetch('/api/chat/transcribe', { method: 'POST', body: transcribeFormData }),
                    ])

                    // Process upload result (for playback URL)
                    const uploadData = await uploadRes.json()
                    if (uploadRes.ok && uploadData.url) {
                        console.log('[Voice] Uploaded to R2:', uploadData.url)
                        setMessages(prev => prev.map(m =>
                            m.id === msgId ? { ...m, audioUrl: uploadData.url } : m
                        ))
                    } else {
                        console.warn('[Voice] R2 upload failed (non-blocking):', uploadRes.status, uploadData)
                    }

                    // Process transcription result
                    const transcribeData = await transcribeRes.json()
                    console.log('[Voice] Transcription result:', transcribeRes.status, transcribeData)
                    const textToSend = transcribeData.text || ''

                    if (!textToSend.trim()) {
                        // Transcription failed — log details and tell user
                        console.error('[Voice] Transcription empty! Server response:', JSON.stringify(transcribeData))
                        setMessages(prev => [...prev, {
                            id: (Date.now() + 1).toString(),
                            role: 'assistant',
                            content: 'Desculpe, não consegui entender o áudio. Pode tentar gravar novamente ou digitar sua mensagem?'
                        }])
                        setIsLoading(false)
                        return
                    }

                    trackEvent('voice_message_sent', { text_length: textToSend.length })

                    // Store transcribed text in state so it is included in history for future turns
                    setMessages(prev => prev.map(m =>
                        m.id === msgId ? { ...m, content: textToSend } : m
                    ))

                    // Step 3: Send transcribed text to AI
                    const apiPromise = fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: textToSend,
                            history: messages,
                            broker,
                            page_context: { type: pageContext.type, id: pageContext.id, slug: pageContext.slug, url: window.location.href },
                            page_content: pageContent,
                            visitor_cookie_id: getVisitorId()
                        })
                    }).then(r => r.json())

                    // Voice messages already had upload+transcription delay, so use shorter typing animation
                    setIsTyping(true)
                    const voiceTypingDuration = 1000 + Math.random() * 1500 // 1–2.5s (shorter than text)
                    const [respData] = await Promise.all([apiPromise, new Promise(resolve => setTimeout(resolve, voiceTypingDuration))])
                    setIsTyping(false)
                    if (respData.response) {
                        playReceivedSound()
                        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: respData.response }])
                    }
                } catch (err: any) {
                    console.error('[Voice] Full Error:', err)
                    console.error('[Voice] Error message:', err?.message)
                    console.error('[Voice] Error stack:', err?.stack)
                    setIsTyping(false)
                    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Desculpe, estou com um probleminha com o áudio. Pode tentar digitar sua mensagem?' }])
                } finally {
                    setIsLoading(false)
                }
            }
            mediaRecorder.start() // Do not use timeslice, it creates invalid WebM blobs when concatenated
            setIsRecording(true)
            setRecordingTime(0)
            recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
        } catch (err) {
            console.error('Mic access denied:', err)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }
        setIsRecording(false)
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current)
            recordingTimerRef.current = null
        }
    }

    // Don't render on admin/login pages or server side
    if (isExcludedPage || !mounted) return null

    return createPortal(
        <div id="pilger-chat-widget" style={{ position: 'fixed', bottom: '90px', right: '24px', zIndex: 9999, fontFamily: 'sans-serif' }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="chat-window"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        style={{
                            width: '380px',
                            height: '600px',
                            backgroundColor: '#ECE5DD',
                            borderRadius: '16px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* WhatsApp Header */}
                        <div style={{
                            padding: '10px 16px',
                            background: 'linear-gradient(to bottom, #075E54, #064E47)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                backgroundColor: '#128C7E', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden', flexShrink: 0,
                            }}>
                                {(connectionStep === 0 || connectionStep >= 2) && broker?.photo_url ? (
                                    <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <User size={22} color="#ccc" />
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {connectionStep === 1 ? 'Central de Atendimento' : (broker?.name || 'Corretor Online')}
                                </h3>
                                {(connectionStep === 0 || connectionStep >= 2) && (
                                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>online</span>
                                )}
                                {connectionStep === 1 && (
                                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>conectando...</span>
                                )}
                            </div>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div style={{
                            flex: 1, padding: '8px 12px', overflowY: 'auto',
                            display: 'flex', flexDirection: 'column', gap: '4px',
                            backgroundColor: '#ECE5DD',
                        }}>
                            {connectionStep > 0 && (
                                <div style={{
                                    textAlign: 'center', padding: '16px',
                                    margin: '8px auto',
                                    backgroundColor: 'rgba(225,218,208,0.92)',
                                    borderRadius: 8, fontSize: '0.8rem', color: '#54656F',
                                    maxWidth: '85%',
                                    boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                                }}>
                                    {connectionStep === 1 && (
                                        <div>
                                            <Search style={{ margin: '0 auto 8px', opacity: 0.5, animation: 'wa-pulse 1.5s infinite' }} size={20} />
                                            <div>Procurando corretor de plantão...</div>
                                        </div>
                                    )}
                                    {connectionStep === 2 && (
                                        <div>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: 'white', fontSize: '1.1rem' }}>✓</div>
                                            <div style={{ color: '#25D366', fontWeight: 600 }}>Corretor encontrado!</div>
                                        </div>
                                    )}
                                    {connectionStep === 3 && (
                                        <div>
                                            <Loader2 className="animate-spin" style={{ margin: '0 auto 8px', opacity: 0.5 }} size={20} />
                                            <div>Conectando...</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {messages.map(msg => {
                                const now = new Date()
                                const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
                                const isUser = msg.role === 'user'
                                return (
                                    <div key={msg.id} style={{
                                        maxWidth: '80%',
                                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                                        marginBottom: 2,
                                    }}>
                                        <div style={{
                                            padding: msg.audioUrl ? '6px 10px' : '6px 8px 4px',
                                            borderRadius: isUser ? '8px 0 8px 8px' : '0 8px 8px 8px',
                                            fontSize: '0.88rem',
                                            lineHeight: '1.35',
                                            backgroundColor: isUser ? '#DCF8C6' : '#FFFFFF',
                                            color: '#111B21',
                                            boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
                                            position: 'relative' as const,
                                            wordBreak: 'break-word' as const,
                                        }}>
                                            {msg.audioDuration !== undefined ? (
                                                /* WhatsApp-style audio bubble */
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
                                                    {msg.audioUrl ? (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const audio = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement
                                                                    if (audio) {
                                                                        if (audio.paused) {
                                                                            audio.play().catch(err => console.error('Audio play failed:', err))
                                                                        } else {
                                                                            audio.pause()
                                                                        }
                                                                    }
                                                                }}
                                                                style={{
                                                                    width: 32, height: 32, borderRadius: '50%',
                                                                    backgroundColor: '#00A884', border: 'none',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    cursor: 'pointer', flexShrink: 0, color: 'white',
                                                                }}
                                                            >
                                                                <svg width="14" height="16" viewBox="0 0 14 16" fill="white">
                                                                    <path d="M1 1.5v13l11-6.5L1 1.5z" />
                                                                </svg>
                                                            </button>
                                                            <audio id={`audio-${msg.id}`} src={msg.audioUrl} preload="auto" style={{ display: 'none' }} />
                                                        </>
                                                    ) : (
                                                        <div style={{
                                                            width: 32, height: 32, borderRadius: '50%',
                                                            backgroundColor: '#8696A0', border: 'none',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}>
                                                            <Loader2 size={16} color="white" className="animate-spin" />
                                                        </div>
                                                    )}
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        {Array.from({ length: 20 }).map((_, i) => (
                                                            <div key={i} style={{
                                                                width: 3, borderRadius: 2,
                                                                height: Math.max(4, Math.random() * 16),
                                                                backgroundColor: '#8696A0',
                                                            }} />
                                                        ))}
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', color: '#667781', whiteSpace: 'nowrap' }}>
                                                        {msg.audioDuration ? `0:${msg.audioDuration.toString().padStart(2, '0')}` : '0:00'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span>{msg.content}</span>
                                            )}
                                            <span style={{
                                                float: 'right' as const,
                                                fontSize: '0.65rem',
                                                color: '#667781',
                                                marginLeft: 8,
                                                marginTop: 4,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 2,
                                                lineHeight: 1,
                                            }}>
                                                {time}
                                                {isUser && (
                                                    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ marginLeft: 2 }}>
                                                        <path d="M11 1L4.5 8.5L1 5.5" stroke="#53BDEB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        <path d="M14.5 1L8 8.5L6 6.5" stroke="#53BDEB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}

                            {(isTyping || (isLoading && !isTyping)) && (
                                <div style={{ maxWidth: '80%', alignSelf: 'flex-start', marginBottom: 2 }}>
                                    <div style={{
                                        padding: '8px 12px',
                                        borderRadius: '0 8px 8px 8px',
                                        backgroundColor: '#FFFFFF',
                                        boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                        <span className="wa-typing-dots">
                                            <span></span><span></span><span></span>
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{
                            padding: '6px 8px',
                            backgroundColor: '#F0F0F0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            {isRecording ? (
                                /* Recording UI */
                                <>
                                    <div style={{
                                        flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                                        backgroundColor: '#FFFFFF', borderRadius: 21, padding: '10px 16px',
                                    }}>
                                        <span className="wa-rec-dot" />
                                        <span style={{ fontSize: '0.9rem', color: '#E53935', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: '#667781', marginLeft: 'auto' }}>Gravando...</span>
                                    </div>
                                    <button onClick={stopRecording} style={{
                                        width: 42, height: 42, backgroundColor: '#E53935', color: 'white',
                                        border: 'none', borderRadius: '50%', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                    }}>
                                        <Square size={16} fill="white" />
                                    </button>
                                </>
                            ) : (
                                /* Normal input */
                                <>
                                    <input
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Mensagem"
                                        style={{
                                            flex: 1, border: 'none', borderRadius: '21px',
                                            padding: '10px 16px', fontSize: '0.9rem',
                                            outline: 'none', backgroundColor: '#FFFFFF', color: '#111B21',
                                        }}
                                        disabled={isLoading}
                                    />
                                    {input.trim() ? (
                                        <button onClick={handleSend} disabled={isLoading} style={{
                                            width: 42, height: 42, backgroundColor: '#075E54', color: 'white',
                                            border: 'none', borderRadius: '50%', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                        }}>
                                            <Send size={18} />
                                        </button>
                                    ) : (
                                        <button onClick={startRecording} disabled={isLoading} style={{
                                            width: 42, height: 42, backgroundColor: '#075E54', color: 'white',
                                            border: 'none', borderRadius: '50%', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                            opacity: isLoading ? 0.5 : 1,
                                        }}>
                                            <Mic size={20} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes wa-pulse {
                    0% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.5; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .wa-rec-dot {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    background: #E53935;
                    border-radius: 50%;
                    animation: wa-rec-pulse 1s ease-in-out infinite;
                }
                @keyframes wa-rec-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.8); }
                }
                .wa-typing-dots {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    height: 17px;
                    padding: 0 4px;
                }
                .wa-typing-dots span {
                    display: block;
                    width: 7px;
                    height: 7px;
                    background: #8696A0;
                    border-radius: 50%;
                    animation: wa-dot-bounce 1.4s infinite both;
                }
                .wa-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                .wa-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes wa-dot-bounce {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-4px); opacity: 1; }
                }
                @media (max-width: 768px) {
                    #pilger-chat-widget {
                        bottom: 0 !important;
                        right: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        z-index: 2147483647 !important;
                    }
                    #pilger-chat-widget .chat-window {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        border-radius: 0 !important;
                        z-index: 10000;
                    }
                }
            `}</style>
        </div >,
        document.body
    )
}
