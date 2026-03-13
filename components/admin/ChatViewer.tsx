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
    brokerName?: string
}

export function ChatViewer({ messages, leadName, brokerName }: ChatViewerProps) {
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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: '#0a0a0a', overflow: 'hidden', minHeight: 0 }}>
            {/* Phone Bezel */}
            <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '360px', maxHeight: '720px', backgroundColor: '#1a1a1a', borderRadius: '32px', border: '8px solid #2a2a2a', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

                {/* Status Bar */}
                <div style={{ height: '28px', backgroundColor: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 'bold', color: '#000', zIndex: 10, flexShrink: 0 }}>
                    <span>9:41</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Signal size={12} fill="black" />
                        <Wifi size={12} />
                        <Battery size={12} fill="black" />
                    </div>
                </div>

                {/* Header (Mimicking ConciergeChat) */}
                <div style={{ backgroundColor: '#1a1a1a', padding: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, borderBottom: '1px solid #333', zIndex: 10 }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#333', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8945f', border: '1px solid #b8945f', overflow: 'hidden' }}>
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
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, lineHeight: 1.2 }}>{brokerName || 'Corretor'}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8, marginTop: '2px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'block' }}></span>
                            <span style={{ fontSize: '10px' }}>Online agora</span>
                        </div>
                    </div>
                </div>

                {/* Screen / Messages Area */}
                <div
                    ref={scrollRef}
                    className="scrollbar-hide"
                    style={{ flex: 1, backgroundColor: '#f9f9f9', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                    {/* Date Divider Mockup */}
                    <div style={{ textAlign: 'center', margin: '8px 0' }}>
                        <span style={{ backgroundColor: '#e5e7eb', color: '#6b7280', fontSize: '10px', padding: '4px 8px', borderRadius: '9999px', fontWeight: 500 }}>Hoje</span>
                    </div>

                    {messages?.map((msg, idx) => {
                        const isUser = msg.role === 'user'
                        const time = formatTime(msg.id)

                        return (
                            <div key={idx} style={{ display: 'flex', gap: '8px', width: '100%', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                                {/* Avatar */}
                                <div style={{ width: '28px', height: '28px', backgroundColor: '#1a1a1a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8945f', flexShrink: 0, border: '1px solid #b8945f', overflow: 'hidden', marginTop: '4px' }}>
                                    {isUser ? (
                                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{leadName?.[0]?.toUpperCase() || 'U'}</span>
                                    ) : (
                                        <img
                                            src="https://framerusercontent.com/images/k2FqGjDq0j8Xyw3mXyv3rU9I.png"
                                            alt="Assistant"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}
                                </div>

                                {/* Bubble */}
                                <div style={{
                                    maxWidth: '75%', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', position: 'relative',
                                    ...(isUser ? {
                                        backgroundColor: '#b8945f', color: '#0a0a0a', borderTopRightRadius: '2px'
                                    } : {
                                        backgroundColor: '#fff', color: '#333', border: '1px solid #e8e5e0', borderTopLeftRadius: '2px'
                                    })
                                }}>
                                    {msg.content}
                                    <div style={{
                                        fontSize: '10px', marginTop: '6px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px',
                                        ...(isUser ? { justifyContent: 'flex-end', color: 'rgba(10,10,10,0.7)' } : { color: '#9ca3af' })
                                    }}>
                                        {time}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Fake Input Area */}
                <div style={{ backgroundColor: '#fff', padding: '16px', borderTop: '1px solid #e8e5e0', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '9999px', height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', color: '#9ca3af', fontSize: '14px', border: '1px solid #e5e7eb', cursor: 'not-allowed' }}>
                        Mensagem...
                    </div>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#1a1a1a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: 0.5, cursor: 'not-allowed' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </div>
                </div>

                {/* Home Indicator */}
                <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', width: '128px', height: '4px', backgroundColor: '#d1d5db', borderRadius: '9999px', marginBottom: '4px' }}></div>
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
