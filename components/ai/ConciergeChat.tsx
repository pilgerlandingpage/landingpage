'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { MessageSquare, X, Send, User, Loader2 } from 'lucide-react'

// Helper to read cookie value (Tracker sets pilger_visitor_id as cookie, NOT localStorage)
function getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
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
    const [isConnecting, setIsConnecting] = useState(false)
    const [hasGreeted, setHasGreeted] = useState(false)
    const [broker, setBroker] = useState<{ name: string; creci: string; photo_url?: string } | null>(null)
    const [pageContent, setPageContent] = useState('')
    const [timing, setTiming] = useState({ delayBeforeTyping: 2000, typingMinDuration: 5000, typingMaxDuration: 7000 })
    const [mounted, setMounted] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Detect Context (Home, Property, Landing Page, Cloned LP)
    const [pageContext, setPageContext] = useState<{ type: 'home' | 'property' | 'landing_page' | 'cloned_landing_page'; id?: string; slug?: string }>({ type: 'home' })
    const pathname = usePathname()

    // Don't render on admin pages or login page
    const isExcludedPage = pathname?.startsWith('/admin') || pathname === '/login' || pathname === '/signup'

    useEffect(() => {
        if (!pathname || isExcludedPage) return

        if (pathname === '/') {
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

    // Auto-open after delay
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isOpen && !hasGreeted) {
                setIsOpen(true)
            }
        }, 15000)
        return () => clearTimeout(timer)
    }, [isOpen, hasGreeted])

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, isOpen, isConnecting, isTyping, scrollToBottom])

    // Initial Greeting
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true)
            setIsConnecting(true)

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
                    // Simulate human connecting delay
                    setTimeout(() => {
                        setIsConnecting(false)
                        setIsTyping(true)
                        // Show typing then show greeting
                        setTimeout(() => {
                            setIsTyping(false)
                            setMessages([{
                                id: 'init',
                                role: 'assistant',
                                content: data.greeting || 'Olá! Como posso te ajudar hoje?'
                            }])
                        }, initTiming.delayBeforeTyping)
                    }, initTiming.delayBeforeTyping)
                })
                .catch(() => {
                    setIsConnecting(false)
                    setMessages([{
                        id: 'init',
                        role: 'assistant',
                        content: 'Olá! Sou corretor da Pilger. Como posso ajudar você hoje?'
                    }])
                })
        }
    }, [isOpen, hasGreeted, pageContext, pageContent])

    const trackEvent = async (eventType: string, metadata: any = {}) => {
        try {
            // Get visitor_cookie_id from cookie (set by Tracker component)
            const visitorCookieId = getCookieValue('pilger_visitor_id')

            await fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_cookie_id: visitorCookieId,
                    landing_page_slug: pageContext.slug,
                    event_type: eventType,
                    metadata,
                    search_params: window.location.search,
                    referrer: document.referrer
                })
            })
        } catch (e) {
            console.error('Tracking error:', e)
        }
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
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
                    visitor_cookie_id: getCookieValue('pilger_visitor_id') // Pass cookie ID for backend tracking
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
                            backgroundColor: 'white',
                            borderRadius: '24px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            border: '1px solid #e8e5e0'
                        }}
                    >
                        {/* Header */}
                        <div style={{ padding: '20px', backgroundColor: '#1a1a1a', color: 'white', display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '44px', height: '44px', backgroundColor: '#333', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8945f', border: '2px solid #b8945f', overflow: 'hidden' }}>
                                {broker?.photo_url ? (
                                    <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <User size={20} />
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{broker?.name || 'Corretor Online'}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="status-indicator"></span>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Online agora</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f9f9f9' }}>
                            {isConnecting && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#666', fontSize: '0.85rem' }}>
                                    <Loader2 className="animate-spin" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                                    Conectando...
                                </div>
                            )}
                            {messages.map(msg => (
                                <div key={msg.id} style={{ display: 'flex', gap: '8px', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                                    {msg.role === 'assistant' && (
                                        <div style={{ width: '28px', height: '28px', backgroundColor: '#1a1a1a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8945f', flexShrink: 0, overflow: 'hidden' }}>
                                            {broker?.photo_url ? (
                                                <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <User size={16} />
                                            )}
                                        </div>
                                    )}
                                    <div style={{
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        fontSize: '0.9rem',
                                        lineHeight: '1.4',
                                        backgroundColor: msg.role === 'assistant' ? 'white' : '#b8945f',
                                        color: msg.role === 'assistant' ? '#333' : 'white',
                                        border: msg.role === 'assistant' ? '1px solid #e8e5e0' : 'none',
                                        borderTopLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                                        borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px'
                                    }}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {/* Typing indicator - shows "digitando..." */}
                            {(isTyping || (isLoading && !isTyping)) && (
                                <div style={{ display: 'flex', gap: '8px', maxWidth: '85%' }}>
                                    <div style={{ width: '28px', height: '28px', backgroundColor: '#1a1a1a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8945f', flexShrink: 0, overflow: 'hidden' }}>
                                        {broker?.photo_url ? (
                                            <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <User size={16} />
                                        )}
                                    </div>
                                    {isTyping ? (
                                        <div style={{ padding: '10px 14px', borderRadius: '12px', borderTopLeftRadius: '2px', backgroundColor: 'white', border: '1px solid #e8e5e0', fontSize: '0.8rem', color: '#999', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.82rem', fontStyle: 'italic' }}>digitando</span>
                                            <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
                                        </div>
                                    ) : (
                                        <div className="msg-bubble typing" style={{ backgroundColor: 'white', border: '1px solid #e8e5e0', padding: '10px 14px', borderRadius: '12px', borderTopLeftRadius: '2px' }}>
                                            <span>.</span><span>.</span><span>.</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div style={{ padding: '16px', borderTop: '1px solid #e8e5e0', display: 'flex', gap: '10px', backgroundColor: 'white' }}>
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Digite sua mensagem..."
                                style={{
                                    flex: 1,
                                    border: '1px solid #e8e5e0',
                                    borderRadius: '50px',
                                    padding: '10px 16px',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: '#1a1a1a',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button with Speech Bubble */}
            {!isOpen && !isConnecting && (
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => {
                    setIsOpen(true)
                    trackEvent('chat_opened')
                }}>
                    {/* Speech Bubble */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="chat-bubble"
                    >
                        Fale com o corretor de plantão agora
                        <div style={{
                            position: 'absolute',
                            right: '-8px',
                            bottom: '15px',
                            width: '16px',
                            height: '16px',
                            backgroundColor: 'white',
                            transform: 'rotate(45deg)',
                            borderRight: '1px solid #e8e5e0',
                            borderTop: '1px solid #e8e5e0'
                        }} />
                    </motion.div>

                    {/* Avatar Toggle */}
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: '64px',
                            height: '64px',
                            backgroundColor: '#1a1a1a',
                            border: '2px solid #b8945f',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 10px 30px rgba(184,148,95,0.3)',
                            overflow: 'hidden'
                        }}
                    >
                        {broker?.photo_url ? (
                            <img src={broker.photo_url} alt="Corretor de Plantão" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <User size={28} color="#b8945f" />
                        )}
                    </motion.div>
                </div>
            )
            }

            <style>{`
                #pilger-chat-widget .status-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    background: #22c55e;
                    border-radius: 50%;
                    box-shadow: 0 0 5px #22c55e;
                    position: relative;
                }
                #pilger-chat-widget .status-indicator::after {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: 50%;
                    border: 1px solid #22c55e;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                #pilger-chat-widget .typing span {
                    animation: blink 1.4s infinite both;
                    font-size: 1.5rem;
                    line-height: 10px;
                    margin: 0 1px;
                }
                #pilger-chat-widget .typing span:nth-child(2) { animation-delay: 0.2s; }
                #pilger-chat-widget .typing span:nth-child(3) { animation-delay: 0.4s; }
                #pilger-chat-widget .typing-dots span {
                    animation: blink 1.4s infinite both;
                    font-size: 1.1rem;
                    font-weight: bold;
                }
                #pilger-chat-widget .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                #pilger-chat-widget .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes blink {
                    0% { opacity: 0.2; }
                    20% { opacity: 1; }
                    100% { opacity: 0.2; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                /* Default Desktop Styles (forced by inline, but good to have backup) */
                
                #pilger-chat-widget .chat-bubble {
                    position: absolute;
                    right: 80px;
                    bottom: 12px;
                    background-color: white;
                    padding: 10px 20px;
                    border-radius: 20px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                    white-space: nowrap;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #333;
                    border: 1px solid #e8e5e0;
                    z-index: 10001;
                }

                @media (max-width: 768px) {
                    #pilger-chat-widget {
                        bottom: 85px !important;
                        right: 16px !important;
                        left: auto !important;
                        width: auto !important;
                        z-index: 2147483647 !important;
                    }
                    #pilger-chat-widget .chat-window {
                        position: fixed;
                        top: 10px;
                        left: 10px;
                        right: 10px;
                        bottom: 10px;
                        width: auto !important;
                        height: auto !important;
                        border-radius: 20px !important;
                        z-index: 10000;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important;
                    }
                    #pilger-chat-widget .chat-bubble {
                        white-space: normal;
                        right: 70px;
                        bottom: 15px;
                        width: max-content;
                        max-width: calc(100vw - 120px);
                        font-size: 0.85rem;
                        padding: 8px 12px;
                        text-align: right;
                    }
                }
            `}</style>
        </div>,
        document.body
    )
}
