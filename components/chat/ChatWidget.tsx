'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface ChatWidgetProps {
    visitorId: string
    landingPageId?: string
    greetingMessage?: string
    agentName?: string
}

export default function ChatWidget({
    visitorId,
    landingPageId,
    greetingMessage = 'Olá! 👋 Seja bem-vindo. Como posso ajudá-lo a encontrar o imóvel dos seus sonhos?',
    agentName = 'Concierge Pilger',
}: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: greetingMessage },
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus()
        }
    }, [isOpen])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setIsLoading(true)

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    visitor_id: visitorId,
                    landing_page_id: landingPageId,
                    history: messages,
                }),
            })

            const data = await response.json()

            if (data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
            }
        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: 'Desculpe, ocorreu um erro. Por favor, tente novamente.' },
            ])
        } finally {
            setIsLoading(false)
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
            {/* Floating toggle button */}
            <button
                className="chat-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
            >
                {isOpen ? (
                    <X size={24} color="#0a0a0a" />
                ) : (
                    <MessageCircle size={24} color="#0a0a0a" />
                )}
            </button>

            {/* Chat panel */}
            {isOpen && (
                <div className="chat-panel">
                    <div className="chat-header">
                        <div className="chat-avatar">🏠</div>
                        <div className="chat-header-info">
                            <h3>{agentName}</h3>
                            <span>Online agora</span>
                        </div>
                        <button className="chat-close" onClick={() => setIsOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className="chat-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`chat-bubble ${msg.role}`}>
                                {msg.content}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="chat-typing">
                                <span />
                                <span />
                                <span />
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-area">
                        <input
                            ref={inputRef}
                            className="chat-input"
                            type="text"
                            placeholder="Digite sua mensagem..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <button
                            className="chat-send"
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
