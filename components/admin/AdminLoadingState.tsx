interface AdminLoadingStateProps {
    message?: string
    minHeight?: string
    embedded?: boolean
}

export default function AdminLoadingState({
    message = 'Carregando dados...',
    minHeight = '60vh',
    embedded = false,
}: AdminLoadingStateProps) {
    const isFullScreen = !embedded

    return (
        <div
            className={`admin-loading-state ${isFullScreen ? 'full' : 'embedded'}`}
            style={embedded ? { minHeight } : undefined}
        >
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
