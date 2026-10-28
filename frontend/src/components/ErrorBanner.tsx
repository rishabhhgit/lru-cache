interface ErrorBannerProps {
    error: string | null;
    onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
    if (!error) return null;
    return (
        <div className="error-banner">
            {error}
            <button
                className="secondary"
                style={{ marginLeft: '1rem', padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                onClick={onDismiss}
            >
                Dismiss
            </button>
        </div>
    );
}
