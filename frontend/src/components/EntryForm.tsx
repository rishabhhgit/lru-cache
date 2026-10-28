import React from 'react';

interface EntryFormProps {
    onPut: (key: string, value: unknown) => void;
    loading: boolean;
    error: string | null;
    setError: (msg: string | null) => void;
}

export function EntryForm({ onPut, loading, error, setError }: EntryFormProps) {
    const [key, setKey] = React.useState('');
    const [value, setValue] = React.useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!key.trim()) {
            setError('Key is required');
            return;
        }
        let parsed: unknown = value;
        try {
            parsed = value.trim() ? JSON.parse(value) : value;
        } catch {
            parsed = value; // store as raw string
        }
        onPut(key.trim(), parsed);
    };

    return (
        <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#94a3b8' }}>
                Put / Update Entry
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 200 }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Key</label>
                    <input
                        type="text"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="e.g. user:1"
                        disabled={loading}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 260 }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                        Value (JSON or plain text)
                    </label>
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder='{"name": "Ada"}'
                        rows={2}
                        disabled={loading}
                    />
                </div>
                <button type="submit" className="primary" disabled={loading}>
                    {loading ? 'Saving…' : 'Save'}
                </button>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    Objects are stored as JSON strings; the gateway serializes them.
                </p>
            </form>
            {error && <div className="error-banner" style={{ marginTop: '0.75rem' }}>{error}</div>}
        </div>
    );
}
