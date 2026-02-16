import React, { useRef, useEffect } from 'react'
import { Bot, User, Battery, Signal, Wifi } from 'lucide-react'

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
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

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
            } catch { return 'Agora' }
        }
        return ''
    }

    return (
        <div className="flex-1 flex items-center justify-center p-8 bg-[#0a0a0a] overflow-hidden">
            {/* Phone Bezel */}
            <div className="relative w-[360px] h-[720px] bg-[#1a1a1a] rounded-[45px] border-[8px] border-[#2a2a2a] shadow-2xl overflow-hidden flex flex-col">

                {/* Status Bar */}
                <div className="h-7 bg-white px-6 flex justify-between items-center text-[10px] font-bold text-black z-10 shrink-0">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5">
                        <Signal size={12} fill="black" />
                        <Wifi size={12} />
                        <Battery size={12} fill="black" />
                    </div>
                </div>

                {/* Header (Mimicking ConciergeChat) */}
                <div className="bg-[#1a1a1a] p-4 text-white flex items-center gap-3 shrink-0 border-b border-[#333] z-10">
                    <div className="w-10 h-10 bg-[#333] rounded-full flex items-center justify-center text-[#b8945f] border border-[#b8945f] overflow-hidden">
                        <img
                            src="https://framerusercontent.com/images/k2FqGjDq0j8Xyw3mXyv3rU9I.png"
                            alt="Broker"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerText = '';
                            }}
                        />
                        {/* Fallback icon handled by css/display none logic above roughly, or better: */}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold m-0 leading-tight">Guilherme Pilger</h3>
                        <div className="flex items-center gap-1.5 opacity-80">
                            <span className="w-2 h-2 rounded-full bg-green-500 block"></span>
                            <span className="text-[10px]">Online agora</span>
                        </div>
                    </div>
                </div>

                {/* Screen / Messages Area */}
                <div
                    ref={scrollRef}
                    className="flex-1 bg-[#f9f9f9] overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide"
                >
                    {/* Date Divider Mockup */}
                    <div className="text-center my-2">
                        <span className="bg-gray-200 text-gray-500 text-[10px] px-2 py-1 rounded-full font-medium">Hoje</span>
                    </div>

                    {messages.map((msg, idx) => {
                        const isUser = msg.role === 'user'
                        const time = formatTime(msg.id)

                        return (
                            <div key={idx} className={`flex gap-2 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Avatar */}
                                <div className="w-7 h-7 bg-[#1a1a1a] rounded-full flex items-center justify-center text-[#b8945f] shrink-0 border border-[#b8945f] overflow-hidden mt-1">
                                    {isUser ? (
                                        <span className="text-xs font-bold">{leadName?.[0]?.toUpperCase() || 'U'}</span>
                                    ) : (
                                        <img
                                            src="https://framerusercontent.com/images/k2FqGjDq0j8Xyw3mXyv3rU9I.png"
                                            alt="Assistant"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>

                                {/* Bubble */}
                                <div className={`
                                    max-w-[75%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed shadow-sm relative
                                    ${isUser
                                        ? 'bg-[#b8945f] text-[#0a0a0a] rounded-tr-sm'
                                        : 'bg-white text-[#333] border border-[#e8e5e0] rounded-tl-sm'}
                                `}>
                                    {msg.content}
                                    <div className={`text-[10px] mt-1.5 opacity-80 flex items-center gap-1 ${isUser ? 'justify-end text-[#0a0a0a]/70' : 'text-gray-400'}`}>
                                        {time}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Fake Input Area */}
                <div className="bg-white p-4 border-t border-[#e8e5e0] flex gap-2 items-center shrink-0">
                    <div className="flex-1 bg-gray-100 rounded-full h-10 px-4 flex items-center text-gray-400 text-sm border border-gray-200 cursor-not-allowed">
                        Mensagem...
                    </div>
                    <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-white opacity-50 cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </div>
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-300 rounded-full mb-1"></div>
            </div>

            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    )
}
