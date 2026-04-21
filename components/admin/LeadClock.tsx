'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'

interface LeadClockProps {
    recentLeads: any[]
}

export default function LeadClock({ recentLeads }: LeadClockProps) {
    const [nowMs, setNowMs] = useState(() => Date.now())

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 30000)
        return () => clearInterval(timer)
    }, [])

    const { lastLeadTime, urgencyColor } = useMemo(() => {
        if (!recentLeads || recentLeads.length === 0) {
            return { lastLeadTime: 'Nenhum lead recente', urgencyColor: 'var(--text-muted)' }
        }

        const lastLead = new Date(recentLeads[0].created_at)
        const diffMs = nowMs - lastLead.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMinutes < 5) {
            return { lastLeadTime: 'Acabou de chegar!', urgencyColor: '#22c55e' }
        }
        if (diffMinutes < 60) {
            return { lastLeadTime: `Ha ${diffMinutes} min`, urgencyColor: '#4ade80' }
        }
        if (diffHours < 24) {
            return { lastLeadTime: `Ha ${diffHours}h e ${diffMinutes % 60}m`, urgencyColor: '#f59e0b' }
        }
        return { lastLeadTime: `Ha ${diffDays} dias`, urgencyColor: '#ef4444' }
    }, [recentLeads, nowMs])

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
                    Ultimo Lead Recebido
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
