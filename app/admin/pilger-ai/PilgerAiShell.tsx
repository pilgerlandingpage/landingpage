import type { ReactNode } from 'react'
import { CheckCircle2, Clock3, GitBranch, ShieldAlert } from 'lucide-react'
import PilgerAiStyles from './PilgerAiStyles'

type Metric = {
    label: string
    value: string
    note: string
}

type Pillar = {
    title: string
    description: string
}

type PilgerAiShellProps = {
    eyebrow: string
    title: string
    description: string
    heroDetailEyebrow?: string
    heroDetailTitle?: string
    heroActions?: ReactNode
    metrics?: Metric[]
    compactMetricsInHero?: boolean
    pillars?: Pillar[]
    hideNote?: boolean
    children?: ReactNode
}

export function PilgerAiShell({
    eyebrow,
    title,
    description,
    heroDetailEyebrow,
    heroDetailTitle,
    heroActions,
    metrics = [],
    compactMetricsInHero = false,
    pillars = [],
    hideNote = false,
    children,
}: PilgerAiShellProps) {
    const showStandaloneMetrics = metrics.length > 0 && !compactMetricsInHero

    return (
        <div className="pilger-ai-page">
            <PilgerAiStyles />
            <div className={`pilger-ai-hero ${compactMetricsInHero ? 'pilger-ai-hero-with-compact-metrics' : ''}`}>
                <div>
                    <span className="pilger-ai-eyebrow">{eyebrow}</span>
                    <h1>{title}</h1>
                    <p>{description}</p>
                    {heroDetailTitle && (
                        <div className="pilger-ai-hero-detail">
                            {heroDetailEyebrow && <span>{heroDetailEyebrow}</span>}
                            <strong><GitBranch size={16} /> {heroDetailTitle}</strong>
                        </div>
                    )}
                </div>
                <div className="pilger-ai-hero-side">
                    <div className="pilger-ai-status">
                        <CheckCircle2 size={18} />
                        Operacao ativa
                    </div>
                    {heroActions && <div className="pilger-ai-hero-actions">{heroActions}</div>}
                    {compactMetricsInHero && metrics.length > 0 && (
                        <div className="pilger-ai-hero-metrics">
                            {metrics.map(metric => (
                                <div className="pilger-ai-hero-metric" key={metric.label} title={metric.note}>
                                    <strong>{metric.value}</strong>
                                    <span>{metric.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showStandaloneMetrics && (
                <div className="pilger-ai-metrics">
                    {metrics.map(metric => (
                        <div className="pilger-ai-metric" key={metric.label}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                            <small>{metric.note}</small>
                        </div>
                    ))}
                </div>
            )}

            {pillars.length > 0 && (
                <div className="pilger-ai-grid">
                    {pillars.map(pillar => (
                        <div className="pilger-ai-card" key={pillar.title}>
                            <div className="pilger-ai-card-icon"><Clock3 size={18} /></div>
                            <h2>{pillar.title}</h2>
                            <p>{pillar.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {children}

            {!hideNote && (
                <div className="pilger-ai-note">
                    <ShieldAlert size={18} />
                    Eventos, tarefas e aprovacoes registram o trabalho dos agentes. A Central de Inteligencia alimenta essa operacao com dados do ecossistema.
                </div>
            )}
        </div>
    )
}
