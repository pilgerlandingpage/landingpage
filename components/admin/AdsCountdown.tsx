'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar } from 'lucide-react'

export default function AdsCountdown({ noMargin }: { noMargin?: boolean }) {
    const [timeLeft, setTimeLeft] = useState<{ daily: string; weekly: number }>({ daily: '00:00:00', weekly: 0 })

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date()
            
            // Forçamos o cálculo baseado no fuso de Brasília (America/Sao_Paulo)
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Sao_Paulo',
                hour12: false,
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            })
            
            const parts = formatter.formatToParts(now)
            const map: Record<string, string> = {}
            parts.forEach(p => map[p.type] = p.value)
            
            // Data atual em SP
            const spNow = new Date(
                parseInt(map.year),
                parseInt(map.month) - 1,
                parseInt(map.day),
                parseInt(map.hour),
                parseInt(map.minute),
                parseInt(map.second)
            )

            // 1. Próxima análise diária (23:00)
            let dailyTarget = new Date(spNow)
            dailyTarget.setHours(23, 0, 0, 0)
            
            if (spNow >= dailyTarget) {
                dailyTarget.setDate(dailyTarget.getDate() + 1)
            }
            
            const diffMs = dailyTarget.getTime() - spNow.getTime()
            const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0')
            const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0')
            const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0')

            // 2. Próxima análise semanal (Segunda 23:00)
            // Day 0 = Sun, 1 = Mon
            let weeklyTarget = new Date(spNow)
            const daysToMonday = (1 - spNow.getDay() + 7) % 7
            weeklyTarget.setDate(spNow.getDate() + daysToMonday)
            weeklyTarget.setHours(23, 0, 0, 0)
            
            if (spNow >= weeklyTarget) {
                weeklyTarget.setDate(weeklyTarget.getDate() + 7)
            }
            
            const daysRemaining = Math.ceil((weeklyTarget.getTime() - spNow.getTime()) / (1000 * 60 * 60 * 24))

            setTimeLeft({ daily: `${h}:${m}:${s}`, weekly: daysRemaining })
        }

        calculateTime()
        const timer = setInterval(calculateTime, 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div style={{ 
            display: 'flex', 
            gap: '16px', 
            marginBottom: noMargin ? '0' : '24px',
            background: 'rgba(201, 169, 110, 0.05)',
            border: '1px solid rgba(201, 169, 110, 0.2)',
            padding: '12px 16px',
            borderRadius: '12px',
            alignItems: 'center'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid rgba(201, 169, 110, 0.2)', paddingRight: '16px' }}>
                <Clock size={16} color="var(--gold)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Próxima Análise Diária:</span>
                <span style={{ fontSize: '0.95rem', color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace', minWidth: '70px' }}>{timeLeft.daily}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="#8b5cf6" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Diretriz Semanal:</span>
                <span style={{ fontSize: '0.95rem', color: '#a78bfa', fontWeight: 700 }}>{timeLeft.weekly} dias</span>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Horário fixo (23:00 BRT) para máxima precisão de métricas.
            </div>
        </div>
    )
}
