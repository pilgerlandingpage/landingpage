interface AdminLoadingStateProps {
    message?: string
    minHeight?: string
}

export default function AdminLoadingState({
    message = 'Carregando dados...',
    minHeight = '60vh',
}: AdminLoadingStateProps) {
    return (
        <div className="admin-loading-state" style={{ minHeight }}>
            <div className="admin-loading-card">
                <div className="admin-loading-chart" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <p>{message}</p>
            </div>
        </div>
    )
}
