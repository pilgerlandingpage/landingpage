'use client'

import { Activity, TrendingUp, BarChart3, Map, Zap, Target } from 'lucide-react'

interface PropertyRadarPanelProps {
    propertyName: string
    city: string
    price: number | null
}

export default function PropertyRadarPanel({ propertyName, city, price }: PropertyRadarPanelProps) {
    // Mock data for the cinematic effect
    const appreciation = '+14.2%'
    const roi = '11.8% a.a.'
    const liquidity = 'Alta'
    
    // Simulate a mini chart — deterministic points
    const chartData = [
        [0,60],[8,58],[16,55],[24,52],[32,48],[40,45],[48,42],[56,38],
        [64,35],[72,32],[80,28],[88,25],[96,22],[100,20]
    ]
    const polyPoints = chartData.map(([x, y]) => `${x},${y}`).join(' ')
    const areaPath = `M0,100 L${chartData.map(([x, y]) => `${x},${y}`).join(' L')} L100,100 Z`

    return (
        <div className="radar-panel">
            <div className="radar-header">
                <div className="radar-title">
                    <Activity size={18} color="#b8945f" />
                    <h3>Inteligência do Ativo</h3>
                </div>
                <div className="radar-badge">
                    <span className="live-dot" />
                    Tempo Real
                </div>
            </div>

            <p className="radar-desc">
                Análise de mercado exclusiva para o ativo <strong>{propertyName}</strong> na região de {city}.
            </p>

            <div className="radar-grid">
                <div className="radar-card">
                    <span className="radar-card-label">Valorização (12m)</span>
                    <strong className="radar-card-value text-green">{appreciation}</strong>
                    <TrendingUp size={14} className="radar-icon-green" />
                </div>
                <div className="radar-card">
                    <span className="radar-card-label">Proj. ROI Aluguel</span>
                    <strong className="radar-card-value">{roi}</strong>
                    <BarChart3 size={14} className="radar-icon-gold" />
                </div>
                <div className="radar-card">
                    <span className="radar-card-label">Liquidez Regional</span>
                    <strong className="radar-card-value">{liquidity}</strong>
                    <Zap size={14} className="radar-icon-blue" />
                </div>
            </div>

            <div className="radar-chart-container">
                <div className="radar-chart-header">
                    <span>Desempenho Histórico ({city})</span>
                    <span className="radar-chart-axis">Out 25 - Out 26</span>
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="radar-svg">
                    <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#b8945f" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#b8945f" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#chartGrad)" />
                    <polyline points={polyPoints} fill="none" stroke="#b8945f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            <style jsx>{`
                .radar-panel {
                    background: #0a0a0a;
                    border: 1px solid rgba(184, 148, 95, 0.2);
                    border-radius: 16px;
                    padding: 32px;
                    color: #fff;
                    font-family: 'Inter', sans-serif;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }
                .radar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding-bottom: 16px;
                }
                .radar-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .radar-title h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .radar-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                    padding: 4px 10px;
                    border-radius: 20px;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }
                .live-dot {
                    width: 6px;
                    height: 6px;
                    background: #22c55e;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.5); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .radar-desc {
                    color: #a3a3a3;
                    font-size: 0.9rem;
                    line-height: 1.5;
                    margin-bottom: 32px;
                }
                .radar-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                    margin-bottom: 32px;
                }
                .radar-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 20px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    position: relative;
                }
                .radar-card-label {
                    font-size: 0.75rem;
                    color: #737373;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .radar-card-value {
                    font-size: 1.4rem;
                    font-weight: 700;
                }
                .text-green { color: #22c55e; }
                .radar-icon-green { position: absolute; top: 16px; right: 16px; color: #22c55e; opacity: 0.5; }
                .radar-icon-gold { position: absolute; top: 16px; right: 16px; color: #b8945f; opacity: 0.5; }
                .radar-icon-blue { position: absolute; top: 16px; right: 16px; color: #3b82f6; opacity: 0.5; }

                .radar-chart-container {
                    background: rgba(255,255,255,0.02);
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .radar-chart-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.75rem;
                    color: #737373;
                    margin-bottom: 16px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .radar-svg {
                    width: 100%;
                    height: 120px;
                    display: block;
                }

                @media (max-width: 768px) {
                    .radar-panel { padding: 24px 20px; }
                    .radar-grid { grid-template-columns: 1fr; gap: 12px; }
                }
            `}</style>
        </div>
    )
}
