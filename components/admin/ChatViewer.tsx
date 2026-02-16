import React from 'react'
import { Bot, User } from 'lucide-react'

interface Message {
    id?: string
    role: 'user' | 'assistant'
    content: string
}

interface ChatViewerProps {
    messages: Message[] | null
    leadName?: string
}

export function ChatViewer({ messages, leadName }: ChatViewerProps) {
    if (!messages || messages.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-[#444] space-y-4 bg-[#111]">
                <div className="h-24 w-24 rounded-full bg-[#1a1a1a] flex items-center justify-center border border-[#2a2a2a]">
                    <Bot className="text-[#333]" size={40} />
                </div>
                <p className="text-sm font-light tracking-wide">Nenhum histórico disponível</p>
            </div>
        )
    }

    // Helper to format timestamp from ID
    const formatTime = (id?: string) => {
        if (!id) return ''
        if (/^\d+$/.test(id)) {
            try {
                const date = new Date(parseInt(id))
                return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            } catch { return '' }
        }
        return ''
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-[#111]">
            {messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                const time = formatTime(msg.id)

                return (
                    <div
                        key={idx}
                        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex max-w-[85%] md:max-w-[70%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

                            {/* Avatar */}
                            <div className={`
                                h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 mt-auto mb-1 shadow-lg
                                ${isUser
                                    ? 'bg-gradient-to-br from-[#c9a96e] to-[#b89a5f] text-[#0a0a0a]'
                                    : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#c9a96e]'}
                            `}>
                                {isUser ? (
                                    <span className="text-sm font-bold">{leadName?.[0]?.toUpperCase() || 'C'}</span>
                                ) : (
                                    <Bot size={20} />
                                )}
                            </div>

                            {/* Bubble Container */}
                            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>

                                {/* The Bubble */}
                                <div
                                    className={`
                                        px-6 py-4 text-[0.95rem] leading-relaxed relative shadow-md
                                        ${isUser
                                            ? 'bg-[#c9a96e] text-[#0a0a0a] rounded-2xl rounded-tr-sm'
                                            : 'bg-[#1e1e1e] text-[#e0e0e0] border border-[#2a2a2a] rounded-2xl rounded-tl-sm'}
                                    `}
                                    style={{
                                        boxShadow: isUser
                                            ? '0 4px 15px rgba(201, 169, 110, 0.15)'
                                            : '0 4px 15px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    {msg.content}
                                </div>

                                {/* Meta info (Outside bubble for clean look, like Leadster) */}
                                <div className={`flex items-center gap-2 mt-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <span className="text-[11px] text-[#666] font-medium uppercase tracking-wider">
                                        {isUser ? 'Você' : 'Pilger AI'}
                                    </span>
                                    {time && (
                                        <span className="text-[11px] text-[#444] opacity-70">
                                            {time}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
