'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, X, Loader2 } from 'lucide-react'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

// Scrape visible page content from the DOM for AI context
function scrapePageContent(): string {
    try {
        const parts: string[] = []
        const title = document.title
        if (title) parts.push(`Título: ${title}`)
        const h1 = document.querySelector('h1')
        if (h1?.textContent) parts.push(`Título principal: ${h1.textContent.trim()}`)
        const priceEl = document.querySelector('[data-price], .price, .property-price')
        if (priceEl?.textContent) parts.push(`Preço: ${priceEl.textContent.trim()}`)
        else {
            const allText = document.body?.innerText || ''
            const priceMatch = allText.match(/R\$\s*[\d.,]+/)
            if (priceMatch) parts.push(`Preço: ${priceMatch[0]}`)
        }
        const descEl = document.querySelector('[data-description], .description, meta[name="description"]')
        if (descEl) {
            const text = descEl instanceof HTMLMetaElement ? descEl.content : descEl.textContent
            if (text?.trim()) parts.push(`Descrição: ${text.trim().substring(0, 300)}`)
        }
        return parts.join('\n')
    } catch { return '' }
}

interface Broker {
    name: string
    creci: string
    photo_url?: string
}

interface ChatWidgetProps {
    visitorId: string
    agentName?: string
    greetingMessage?: string
    landingPageId?: string
    pageContext?: string  // Contexto da página (título, preço, etc.)
}

export default function ChatWidget({ visitorId, agentName, greetingMessage, landingPageId, pageContext }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [isTyping, setIsTyping] = useState(false) // "digitando..." state
    const [scrapedContent, setScrapedContent] = useState('')

    // Broker state
    const [broker, setBroker] = useState<Broker | null>(null)
    const [connecting, setConnecting] = useState(false)
    const [hasInitialized, setHasInitialized] = useState(false)
    const [timing, setTiming] = useState({ delayBeforeTyping: 2000, typingMinDuration: 5000, typingMaxDuration: 7000 })

    // Scrape page content on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setScrapedContent(scrapePageContent())
        }, 1500)
        return () => clearTimeout(timer)
    }, [])

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(scrollToBottom, [messages, scrollToBottom])

    // Initialize: fetch broker when chat opens for the first time
    useEffect(() => {
        if (!isOpen || hasInitialized) return

        const initChat = async () => {
            setConnecting(true)
            try {
                const params = new URLSearchParams()
                if (landingPageId) params.set('landingPageId', landingPageId)

                const res = await fetch(`/api/chat/init?${params.toString()}`)
                const data = await res.json()

                // Simulate "connecting to broker" delay
                await new Promise(r => setTimeout(r, 2500))

                if (data.broker) {
                    setBroker(data.broker)
                }
                if (data.timing) {
                    setTiming(data.timing)
                }

                const greeting = data.greeting || greetingMessage || `Olá! Sou o corretor ${data.broker?.name || agentName || 'Pilger'}. Como posso te ajudar?`
                setMessages([{ role: 'assistant', content: greeting }])
            } catch {
                setMessages([{
                    role: 'assistant',
                    content: greetingMessage || 'Olá! Como posso te ajudar?'
                }])
            } finally {
                setConnecting(false)
                setHasInitialized(true)
            }
        }

        initChat()
    }, [isOpen, hasInitialized, landingPageId, greetingMessage, agentName])

    const sendMessage = async () => {
        if (!input.trim() || loading) return
        const userMessage = input.trim()
        setInput('')

        const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }]
        setMessages(newMessages)
        setLoading(true)

        try {
            // Start API call immediately (runs in background)
            const apiPromise = fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: newMessages,
                    broker: broker,
                    landing_page_id: landingPageId,
                    page_context: pageContext,
                    page_content: scrapedContent,
                    visitor_id: visitorId
                }),
            }).then(res => res.json())

            // Stage 1: Wait (silence — reading the message)
            await new Promise(resolve => setTimeout(resolve, timing.delayBeforeTyping))

            // Stage 2: Show "digitando..." for configured duration
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
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
            }
        } catch {
            setIsTyping(false)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Desculpe, estou com dificuldades. Pode tentar novamente?'
            }])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    return (
        <>
            {/* Chat Window */}
            {isOpen && (
                <div className="cw-window">
                    {/* Header */}
                    <div className="cw-header">
                        <div className="cw-header-info">
                            {broker?.photo_url ? (
                                <img src={broker.photo_url} alt={broker.name} className="cw-avatar-img" />
                            ) : (
                                <div className="cw-avatar">{broker?.name?.charAt(0) || '🏠'}</div>
                            )}
                            <div>
                                <div className="cw-name">{broker?.name || agentName || 'Corretor Pilger'}</div>
                                <div className="cw-status">
                                    <span className="cw-status-dot" />
                                    Online agora
                                </div>
                            </div>
                        </div>
                        <button className="cw-close" onClick={() => setIsOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="cw-messages">
                        {connecting ? (
                            <div className="cw-connecting">
                                <Loader2 size={24} className="cw-spin" />
                                <span>Buscando corretor de plantão...</span>
                            </div>
                        ) : (
                            messages.map((msg, i) => (
                                <div key={i} className={`cw-msg cw-msg-${msg.role}`}>
                                    {msg.role === 'assistant' && broker?.photo_url && (
                                        <img src={broker.photo_url} alt="" className="cw-msg-avatar" />
                                    )}
                                    <div className={`cw-bubble cw-bubble-${msg.role}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        )}
                        {(isTyping || loading) && (
                            <div className="cw-msg cw-msg-assistant">
                                {isTyping ? (
                                    <div className="cw-bubble cw-bubble-assistant" style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        digitando<span className="cw-typing"><span /><span /><span /></span>
                                    </div>
                                ) : (
                                    <div className="cw-bubble cw-bubble-assistant cw-typing">
                                        <span /><span /><span />
                                    </div>
                                )}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="cw-input-area">
                        <input
                            type="text"
                            className="cw-input"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite sua mensagem..."
                            disabled={connecting || loading}
                        />
                        <button className="cw-send" onClick={sendMessage} disabled={!input.trim() || loading || connecting}>
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button className="cw-toggle chat-toggle" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>

            <style jsx>{`
                /* === TOGGLE === */
                .cw-toggle {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 1000;
                    width: 56px; height: 56px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #c9a96e, #8a6d3b);
                    color: white;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(201, 169, 110, 0.4);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .cw-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 30px rgba(201, 169, 110, 0.5);
                }

                /* === WINDOW === */
                .cw-window {
                    position: fixed;
                    bottom: 88px;
                    right: 20px;
                    z-index: 999;
                    width: 380px;
                    max-height: 520px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: cw-slide-up 0.3s ease-out;
                }

                @keyframes cw-slide-up {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                /* === HEADER === */
                .cw-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 16px;
                    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
                    color: white;
                }
                .cw-header-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cw-avatar {
                    width: 36px; height: 36px;
                    background: linear-gradient(135deg, #c9a96e, #8a6d3b);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                    font-weight: 700;
                }
                .cw-avatar-img {
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid #c9a96e;
                }
                .cw-name {
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                .cw-status {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.7rem;
                    opacity: 0.7;
                }
                .cw-status-dot {
                    width: 6px; height: 6px;
                    background: #22c55e;
                    border-radius: 50%;
                }
                .cw-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                    padding: 4px;
                }
                .cw-close:hover { opacity: 1; }

                /* === MESSAGES === */
                .cw-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    min-height: 280px;
                    max-height: 350px;
                    background: #f9f9f7;
                }

                /* Connecting animation */
                .cw-connecting {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    height: 100%;
                    min-height: 200px;
                    color: #888;
                    font-size: 0.85rem;
                }
                .cw-spin {
                    animation: cw-spin-anim 1s linear infinite;
                    color: #c9a96e;
                }
                @keyframes cw-spin-anim {
                    to { transform: rotate(360deg); }
                }

                /* Message bubbles */
                .cw-msg {
                    display: flex;
                    gap: 6px;
                    align-items: flex-end;
                }
                .cw-msg-user { justify-content: flex-end; }
                .cw-msg-assistant { justify-content: flex-start; }

                .cw-msg-avatar {
                    width: 24px; height: 24px;
                    border-radius: 50%;
                    object-fit: cover;
                    flex-shrink: 0;
                }

                .cw-bubble {
                    max-width: 80%;
                    padding: 10px 14px;
                    border-radius: 16px;
                    font-size: 0.88rem;
                    line-height: 1.5;
                    word-break: break-word;
                }
                .cw-bubble-user {
                    background: linear-gradient(135deg, #c9a96e, #a8854f);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .cw-bubble-assistant {
                    background: white;
                    color: #333;
                    border: 1px solid #e8e5e0;
                    border-bottom-left-radius: 4px;
                }

                /* Typing indicator */
                .cw-typing {
                    display: flex;
                    gap: 4px;
                    padding: 12px 18px;
                }
                .cw-typing span {
                    width: 6px; height: 6px;
                    background: #bbb;
                    border-radius: 50%;
                    animation: cw-bounce 1.4s ease-in-out infinite;
                }
                .cw-typing span:nth-child(2) { animation-delay: 0.2s; }
                .cw-typing span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes cw-bounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }

                /* === INPUT === */
                .cw-input-area {
                    display: flex;
                    gap: 8px;
                    padding: 12px 14px;
                    border-top: 1px solid #e8e5e0;
                    background: white;
                }
                .cw-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid #e0ddd8;
                    border-radius: 50px;
                    font-size: 0.88rem;
                    outline: none;
                    transition: border-color 0.2s;
                    color: #333;
                    background: #faf9f7;
                }
                .cw-input:focus {
                    border-color: #c9a96e;
                }
                .cw-input::placeholder {
                    color: #aaa;
                }
                .cw-send {
                    width: 40px; height: 40px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #c9a96e, #8a6d3b);
                    color: white;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s, opacity 0.2s;
                    flex-shrink: 0;
                }
                .cw-send:hover { transform: scale(1.05); }
                .cw-send:disabled { opacity: 0.4; cursor: not-allowed; }

                /* === MOBILE FULLSCREEN === */
                @media (max-width: 480px) {
                    .cw-window {
                        bottom: 0;
                        right: 0;
                        width: 100%;
                        max-height: 100%;
                        height: 100vh;
                        height: 100dvh;
                        border-radius: 0;
                    }
                    .cw-messages {
                        max-height: none;
                        flex: 1;
                    }
                    .cw-toggle {
                        bottom: 16px;
                        right: 16px;
                    }
                }
            `}</style>
        </>
    )
}
