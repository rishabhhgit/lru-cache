import React from 'react';
import type { OperationLog } from '@/types/cache';

interface OperationHistoryProps {
    logs: OperationLog[];
    onClearLogs: () => void;
}

export const OperationHistory: React.FC<OperationHistoryProps> = ({ logs, onClearLogs }) => {
    return (
        <div className="cl-card cl-history-card">
            <div className="cl-card-header">
                <div className="cl-card-title-box">
                    <h3 className="cl-card-title">
                        📜 Live Operation History <span className="cl-count-pill">{logs.length}</span>
                    </h3>
                    <span className="cl-card-subtitle">
                        Session audit trail • In-memory frontend log of all cache interactions
                    </span>
                </div>

                {logs.length > 0 && (
                    <button className="cl-btn-ghost-sm" onClick={onClearLogs}>
                        Clear History
                    </button>
                )}
            </div>

            <div className="cl-table-responsive cl-history-table-box">
                {logs.length === 0 ? (
                    <div className="cl-empty-state">
                        <div className="cl-empty-text">No operations recorded yet</div>
                        <div className="cl-empty-sub">
                            Perform GET, PUT, DELETE, or RESIZE actions to populate this timeline.
                        </div>
                    </div>
                ) : (
                    <table className="cl-history-table">
                        <thead>
                            <tr>
                                <th style={{ width: '90px' }}>Time</th>
                                <th style={{ width: '80px' }}>Type</th>
                                <th>Target Key</th>
                                <th>Outcome & Details</th>
                                <th style={{ width: '80px' }}>Latency</th>
                                <th style={{ width: '70px' }}>Size</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => {
                                let badgeClass = 'badge-op-other';
                                if (log.type === 'GET') {
                                    badgeClass = log.hit ? 'badge-op-hit' : 'badge-op-miss';
                                } else if (log.type === 'PUT') {
                                    badgeClass = log.evictedKey ? 'badge-op-evict' : 'badge-op-put';
                                } else if (log.type === 'DELETE') {
                                    badgeClass = 'badge-op-del';
                                }

                                return (
                                    <tr key={log.id}>
                                        <td className="cl-cell-time">{log.timestamp}</td>
                                        <td>
                                            <span className={`cl-badge-op ${badgeClass}`}>
                                                {log.type}
                                            </span>
                                        </td>
                                        <td className="cl-cell-key">
                                            {log.key ? <code>{log.key}</code> : <span className="text-muted">—</span>}
                                        </td>
                                        <td className="cl-cell-message">
                                            <div className="cl-msg-line">{log.message}</div>
                                            {log.evictedKey && (
                                                <div className="cl-evict-warning">
                                                    ⚠️ Evicted oldest key: <code>{log.evictedKey}</code>
                                                </div>
                                            )}
                                        </td>
                                        <td className="cl-cell-latency">
                                            <span className="cl-latency-pill">{log.latencyMs}ms</span>
                                        </td>
                                        <td className="cl-cell-size">
                                            {log.sizeAfter !== undefined ? log.sizeAfter : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="cl-history-footer">
                <span className="cl-history-disclaimer">
                    ℹ️ Note: This audit trail is retained in browser session memory and resets on full page refresh. Cache state lives in the C++ server.
                </span>
            </div>
        </div>
    );
};
