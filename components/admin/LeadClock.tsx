'use client'

import { useState, useEffect } from 'react'
import { Bell, Clock } from 'lucide-react'

interface LeadClockProps {
    recentLeads: any[]
}

export default function LeadClock({ recentLeads }: LeadClockProps) {
    const [lastLeadTime, setLastLeadTime] = useState<string>('Nenhum lead hoje')
    const [urgencyColor, setUrgencyColor] = useState<string>('var(--text-muted)')

    useEffect(() => {
        if (!recentLeads || recentLeads.length === 0) {
            setLastLeadTime('Nenhum lead recente')
            return
        }

        const updateClock = () => {
            const lastLead = new Date(recentLeads[0].created_at)
            const now = new Date()
            const diffMs = now.getTime() - lastLead.getTime()
            
            const diffMinutes = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMinutes / 60)
            const diffDays = Math.floor(diffHours / 24)

            if (diffMinutes < 5) {
                setLastLeadTime('Acabou de chegar! 🚀')
                setUrgencyColor('#22c55e')
            } else if (diffMinutes < 60) {
                setLastLeadTime(`Há ${diffMinutes} min`)
                setUrgencyColor('#4ade80')
            } else if (diffHours < 24) {
                setLastLeadTime(`Há ${diffHours}h e ${diffMinutes % 60}m`)
                setUrgencyColor('#f59e0b')
            } else {
                setLastLeadTime(`Há ${diffDays} dias`)
                setUrgencyColor('#ef4444')
            }
        }

        updateClock()
        const timer = setInterval(updateClock, 30000) // Update every 30s
        return () => clearInterval(timer)
    }, [recentLeads])

    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            background: 'rgba(201, 169, 110, 0.05)',
            border: '1px solid rgba(201, 169, 110, 0.2)',
            padding: '12px 16px',
            borderRadius: '12px',
            height: '100%',
            boxSizing: 'border-box'
        }}>
            <div style={{ position: 'relative' }}>
                <Bell size={18} color="var(--gold)" className={recentLeads.length > 0 ? 'pulse' : ''} />
                {recentLeads.length > 0 && (
                    <span style={{ 
                        position: 'absolute', 
                        top: -2, 
                        right: -2, 
                        width: 8, 
                        height: 8, 
                        background: '#22c55e', 
                        borderRadius: '50%',
                        border: '2px solid #000'
                    }} />
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Último Lead Recebido
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: urgencyColor }}>
                    {lastLeadTime}
                </span>
            </div>
            
            <style jsx>{`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                .pulse { animation: pulse 2s infinite; }
            `}</style>
        </div>
    )
}
