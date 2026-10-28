import React from 'react';
import type { CacheStats } from '@/types/cache';
import {
    TerminalIcon,
    LayersIcon,
    BookOpenIcon,
    CodeIcon,
    TrashIcon,
    RefreshIcon,
} from './Icons';

interface HeaderProps {
    stats: CacheStats | null;
    isEngineOnline: boolean;
    activeTab: 'dashboard' | 'learn' | 'code';
    setActiveTab: (tab: 'dashboard' | 'learn' | 'code') => void;
    onResize: (cap: number) => void;
    onClear: () => void;
    onResetStats: () => void;
    loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
    stats,
    isEngineOnline,
    activeTab,
    setActiveTab,
    onResize,
    onClear,
    onResetStats,
    loading,
}) => {
    const [customCap, setCustomCap] = React.useState('');
    const [confirmClear, setConfirmClear] = React.useState(false);
    const [confirmReset, setConfirmReset] = React.useState(false);

    const handleCustomResize = (e: React.FormEvent) => {
        e.preventDefault();
        const cap = parseInt(customCap, 10);
        if (Number.isInteger(cap) && cap > 0) {
            onResize(cap);
            setCustomCap('');
        }
    };

    return (
        <header className="cl-header">
            <div className="cl-header-top">
                <div className="cl-brand">
                    <div className="cl-logo-box">
                        <TerminalIcon size={16} />
                    </div>
                    <div className="cl-brand-info">
                        <div className="cl-brand-title">
                            CacheLab <span className="cl-badge-engine">C++20</span>
                        </div>
                        <div className="cl-brand-sub">
                            High-Performance LRU Cache Engine & Visualizer
                        </div>
                    </div>
                </div>

                <div className="cl-header-actions">
                    <div className={`cl-status-pill ${isEngineOnline ? 'online' : 'offline'}`} title={isEngineOnline ? 'Connected to C++ LRU Server' : 'C++ Server Unreachable'}>
                        <span className="cl-status-dot" />
                        <span className="cl-status-text">
                            {isEngineOnline ? 'C++ Engine 8080' : 'Engine Offline'}
                        </span>
                    </div>

                    <div className="cl-nav-tabs">
                        <button
                            className={`cl-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            <LayersIcon size={13} /> Visualizer
                        </button>
                        <button
                            className={`cl-tab-btn ${activeTab === 'learn' ? 'active' : ''}`}
                            onClick={() => setActiveTab('learn')}
                        >
                            <BookOpenIcon size={13} /> Learn LRU
                        </button>
                        <button
                            className={`cl-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                            onClick={() => setActiveTab('code')}
                        >
                            <CodeIcon size={13} /> Engine Code
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'dashboard' && (
                <div className="cl-header-controls">
                    <div className="cl-capacity-controls">
                        <span className="cl-control-label">Capacity:</span>
                        <div className="cl-preset-group">
                            {[3, 5, 8, 10, 16].map((cap) => (
                                <button
                                    key={cap}
                                    className={`cl-preset-btn ${stats?.capacity === cap ? 'active' : ''}`}
                                    onClick={() => onResize(cap)}
                                    disabled={loading}
                                >
                                    {cap}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleCustomResize} className="cl-custom-cap-form">
                            <input
                                type="number"
                                min="1"
                                max="1000"
                                placeholder="Custom"
                                value={customCap}
                                onChange={(e) => setCustomCap(e.target.value)}
                                className="cl-input-cap"
                                disabled={loading}
                            />
                            <button type="submit" className="cl-btn-cap-set" disabled={loading || !customCap}>
                                Set
                            </button>
                        </form>
                    </div>

                    <div className="cl-global-actions">
                        {confirmClear ? (
                            <div className="cl-confirm-group">
                                <span className="cl-confirm-text">Clear cache?</span>
                                <button
                                    className="cl-btn-danger-confirm"
                                    onClick={() => {
                                        onClear();
                                        setConfirmClear(false);
                                    }}
                                    disabled={loading}
                                >
                                    Confirm
                                </button>
                                <button className="cl-btn-ghost-sm" onClick={() => setConfirmClear(false)}>
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                className="cl-btn-action-ghost"
                                onClick={() => setConfirmClear(true)}
                                disabled={loading || !stats || stats.size === 0}
                                title="Remove all entries from cache"
                            >
                                <TrashIcon size={13} /> Clear
                            </button>
                        )}

                        {confirmReset ? (
                            <div className="cl-confirm-group">
                                <span className="cl-confirm-text">Reset stats?</span>
                                <button
                                    className="cl-btn-danger-confirm"
                                    onClick={() => {
                                        onResetStats();
                                        setConfirmReset(false);
                                    }}
                                    disabled={loading}
                                >
                                    Confirm
                                </button>
                                <button className="cl-btn-ghost-sm" onClick={() => setConfirmReset(false)}>
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                className="cl-btn-action-ghost"
                                onClick={() => setConfirmReset(true)}
                                disabled={loading}
                                title="Reset hit/miss/eviction counters"
                            >
                                <RefreshIcon size={13} /> Reset Stats
                            </button>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};
