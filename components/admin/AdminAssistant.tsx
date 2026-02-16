'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, User, Bot, Loader2, Sparkles } from 'lucide-react'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
}

export default function AdminAssistant() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [hasGreeted, setHasGreeted] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const broker = {
        name: 'Pilger AI',
        creci: 'Assistente Administrativo',
        photo_url: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png'
    }

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isOpen])

    // Initial Greeting
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true)
            setMessages([{
                id: 'init',
                role: 'assistant',
                content: 'Olá! Sou o Pilger AI, seu assistente administrativo. Como posso ajudar você a gerenciar a plataforma hoje?'
            }])
        }
    }, [isOpen, hasGreeted])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        const sendTime = Date.now()

        // Show "digitando..." after 2 seconds
        const typingTimer = setTimeout(() => {
            setIsTyping(true)
        }, 2000)

        try {
            const res = await fetch('/api/chat/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.content,
                    history: messages
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.details || data.error)

            // Ensure minimum 5 seconds total delay for human feel
            const elapsed = Date.now() - sendTime
            const remainingDelay = Math.max(0, 5000 - elapsed)

            setTimeout(() => {
                clearTimeout(typingTimer)
                setIsTyping(false)
                const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response }
                setMessages(prev => [...prev, aiMsg])
                setIsLoading(false)
            }, remainingDelay)
        } catch (error: any) {
            console.error(error)
            clearTimeout(typingTimer)
            setIsTyping(false)
            setIsLoading(false)
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Desculpe, tive um problema técnico (${error.message}). Pode repetir?`
            }])
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, fontFamily: 'sans-serif' }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        style={{
                            width: '400px',
                            height: '600px',
                            backgroundColor: '#0f0f0f',
                            borderRadius: '24px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            border: '1px solid rgba(184, 148, 95, 0.2)'
                        }}
                    >
                        {/* Header */}
                        <div style={{ padding: '24px', backgroundColor: '#1a1a1a', color: 'white', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid rgba(184, 148, 95, 0.1)' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #b8945f', overflow: 'hidden', flexShrink: 0 }}>
                                <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#b8945f' }}>{broker.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '2px' }}>
                                    <span style={{ width: '8px', height: '8px', backgroundColor: '#b8945f', borderRadius: '50%', boxShadow: '0 0 8px #b8945f' }}></span>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Online agora</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#0a0a0a' }}>
                            {messages.map(msg => (
                                <div key={msg.id} style={{ display: 'flex', gap: '12px', maxWidth: '88%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                                    {msg.role === 'assistant' && (
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #b8945f', overflow: 'hidden', flexShrink: 0 }}>
                                            <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        fontSize: '0.95rem',
                                        lineHeight: '1.5',
                                        backgroundColor: msg.role === 'assistant' ? '#1a1a1a' : '#b8945f',
                                        color: msg.role === 'assistant' ? '#e5e5e5' : 'black',
                                        border: msg.role === 'assistant' ? '1px solid rgba(184, 148, 95, 0.1)' : 'none',
                                        fontWeight: msg.role === 'assistant' ? 'normal' : '500',
                                        borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                                        borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px'
                                    }}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {(isTyping || isLoading) && (
                                <div style={{ display: 'flex', gap: '12px', maxWidth: '88%' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #b8945f', overflow: 'hidden', flexShrink: 0 }}>
                                        <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    {isTyping ? (
                                        <div style={{ padding: '12px 16px', borderRadius: '16px', backgroundColor: '#1a1a1a', border: '1px solid rgba(184, 148, 95, 0.1)', borderTopLeftRadius: '4px', fontSize: '0.85rem', color: '#888', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            digitando
                                            <span style={{ display: 'inline-flex', gap: '2px' }}>
                                                <span className="admin-typing-dot" style={{ animationDelay: '0ms' }}>.</span>
                                                <span className="admin-typing-dot" style={{ animationDelay: '200ms' }}>.</span>
                                                <span className="admin-typing-dot" style={{ animationDelay: '400ms' }}>.</span>
                                            </span>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '12px 16px', borderRadius: '16px', backgroundColor: '#1a1a1a', border: '1px solid rgba(184, 148, 95, 0.1)', borderTopLeftRadius: '4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <div className="w-1.5 h-1.5 bg-[#b8945f] rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-[#b8945f] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-1.5 h-1.5 bg-[#b8945f] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div style={{ padding: '20px', borderTop: '1px solid rgba(184, 148, 95, 0.1)', display: 'flex', gap: '12px', backgroundColor: '#111' }}>
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Como posso ajudar no admin?"
                                style={{
                                    flex: 1,
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid rgba(184, 148, 95, 0.2)',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    color: 'white',
                                    outline: 'none'
                                }}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    backgroundColor: '#b8945f',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    opacity: (!input.trim() || isLoading) ? 0.5 : 1
                                }}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            {!isOpen && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(true)}
                    style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#1a1a1a',
                        border: '2px solid #b8945f',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 30px rgba(184, 148, 95, 0.3)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        padding: 0
                    }}
                >
                    <img src={broker.photo_url} alt="Pilger AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </motion.button>
            )}
        </div>
    )
}
