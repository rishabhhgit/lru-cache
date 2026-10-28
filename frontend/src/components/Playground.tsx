import React, { useState } from 'react';
import type { GetEntryResponse, PutEntryResponse } from '@/types/cache';
import { TerminalIcon } from './Icons';

interface PlaygroundProps {
    onGet: (key: string) => Promise<GetEntryResponse>;
    onPut: (key: string, value: string) => Promise<PutEntryResponse>;
    onDelete: (key: string) => Promise<void>;
    loading: boolean;
}

export const Playground: React.FC<PlaygroundProps> = ({
    onGet,
    onPut,
    onDelete,
    loading,
}) => {
    // Operation Tab
    const [opTab, setOpTab] = useState<'put' | 'get' | 'delete'>('put');

    // PUT state
    const [putKey, setPutKey] = useState('');
    const [putVal, setPutVal] = useState('');
    const [putResult, setPutResult] = useState<PutEntryResponse | null>(null);

    // GET state
    const [getKey, setGetKey] = useState('');
    const [getResult, setGetResult] = useState<GetEntryResponse | null>(null);

    // DELETE state
    const [deleteKey, setDeleteKey] = useState('');
    const [deleteResult, setDeleteResult] = useState<string | null>(null);

    // Error state
    const [error, setError] = useState<string | null>(null);

    const handlePutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!putKey.trim()) {
            setError('Key is required');
            return;
        }
        if (!putVal.trim()) {
            setError('Value is required');
            return;
        }
        try {
            const res = await onPut(putKey.trim(), putVal.trim());
            setPutResult(res);
            setPutKey('');
            setPutVal('');
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleGetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!getKey.trim()) {
            setError('Key is required');
            return;
        }
        try {
            const res = await onGet(getKey.trim());
            setGetResult(res);
            setGetKey('');
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleDeleteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!deleteKey.trim()) {
            setError('Key is required');
            return;
        }
        try {
            await onDelete(deleteKey.trim());
            setDeleteResult(`Key "${deleteKey.trim()}" successfully deleted`);
            setDeleteKey('');
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="cl-card cl-playground-card">
            <div className="cl-card-header">
                <div className="cl-card-title-box">
                    <h3 className="cl-card-title">
                        <TerminalIcon size={14} /> Operation Playground
                    </h3>
                    <span className="cl-card-subtitle">Execute live LRU operations directly against the C++ engine</span>
                </div>

                <div className="cl-subnav-pills">
                    <button
                        className={`cl-subnav-btn ${opTab === 'put' ? 'active' : ''}`}
                        onClick={() => { setOpTab('put'); setError(null); }}
                    >
                        PUT
                    </button>
                    <button
                        className={`cl-subnav-btn ${opTab === 'get' ? 'active' : ''}`}
                        onClick={() => { setOpTab('get'); setError(null); }}
                    >
                        GET
                    </button>
                    <button
                        className={`cl-subnav-btn ${opTab === 'delete' ? 'active' : ''}`}
                        onClick={() => { setOpTab('delete'); setError(null); }}
                    >
                        DELETE
                    </button>
                </div>
            </div>

            <div className="cl-playground-body">
                {error && (
                    <div className="cl-alert cl-alert-error">
                        <span>⚠ {error}</span>
                        <button className="cl-alert-dismiss" onClick={() => setError(null)}>✕</button>
                    </div>
                )}

                {/* PUT TAB */}
                {opTab === 'put' && (
                    <form onSubmit={handlePutSubmit} className="cl-form">
                        <div className="cl-form-row">
                            <div className="cl-form-group flex-1">
                                <label className="cl-form-label">Key (Unique identifier)</label>
                                <input
                                    type="text"
                                    className="cl-input"
                                    placeholder="e.g. user:1, session_token, page_id"
                                    value={putKey}
                                    onChange={(e) => setPutKey(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            <div className="cl-form-group flex-2">
                                <label className="cl-form-label">Value (Payload / Data)</label>
                                <input
                                    type="text"
                                    className="cl-input"
                                    placeholder='e.g. {"name":"Ada"} or raw string'
                                    value={putVal}
                                    onChange={(e) => setPutVal(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                className="cl-btn-primary cl-btn-submit"
                                disabled={loading || !putKey.trim() || !putVal.trim()}
                            >
                                {loading ? 'Saving…' : 'Execute PUT'}
                            </button>
                        </div>

                        {/* PUT Result Banner */}
                        {putResult && (
                            <div className="cl-result-box put-result">
                                <div className="cl-result-header">
                                    <span className="cl-result-tag tag-success">
                                        {putResult.inserted ? 'INSERT' : 'UPDATE'}
                                    </span>
                                    <span className="cl-result-key">Key: <code>{putResult.key}</code></span>
                                    {putResult.evicted && (
                                        <span className="cl-result-tag tag-warning">
                                            Evicted: <code>{putResult.evicted_entry?.key}</code>
                                        </span>
                                    )}
                                </div>
                                <div className="cl-result-body">
                                    <span className="cl-result-desc">
                                        {putResult.inserted
                                            ? putResult.evicted
                                                ? `New key inserted at MRU. Cache was full, so LRU entry "${putResult.evicted_entry?.key}" was evicted in O(1).`
                                                : `New key "${putResult.key}" added to the most recently used (MRU) position.`
                                            : `Existing key "${putResult.key}" updated in-place and moved to the MRU position without creating duplicates.`}
                                    </span>
                                </div>
                            </div>
                        )}
                    </form>
                )}

                {/* GET TAB */}
                {opTab === 'get' && (
                    <form onSubmit={handleGetSubmit} className="cl-form">
                        <div className="cl-form-row">
                            <div className="cl-form-group flex-2">
                                <label className="cl-form-label">Target Key to Look Up</label>
                                <input
                                    type="text"
                                    className="cl-input"
                                    placeholder="e.g. user:1"
                                    value={getKey}
                                    onChange={(e) => setGetKey(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                className="cl-btn-primary cl-btn-submit"
                                disabled={loading || !getKey.trim()}
                            >
                                {loading ? 'Fetching…' : 'Execute GET'}
                            </button>
                        </div>

                        {/* GET Result Banner */}
                        {getResult && (
                            <div className={`cl-result-box ${getResult.hit ? 'get-hit' : 'get-miss'}`}>
                                <div className="cl-result-header">
                                    <span className={`cl-result-tag ${getResult.hit ? 'tag-hit' : 'tag-miss'}`}>
                                        {getResult.hit ? 'CACHE HIT' : 'CACHE MISS (404)'}
                                    </span>
                                    <span className="cl-result-key">Key: <code>{getResult.key}</code></span>
                                </div>
                                <div className="cl-result-body">
                                    {getResult.hit ? (
                                        <div>
                                            <div className="cl-result-desc">
                                                Found in O(1) hash map lookup! Spliced to the MRU (tail) position in the linked list.
                                            </div>
                                            <div className="cl-result-value-display">
                                                Value: <code>{getResult.value}</code>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="cl-result-desc">
                                            Key is not in the cache. Hit counter unchanged, miss counter incremented. List recency order remains unchanged.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </form>
                )}

                {/* DELETE TAB */}
                {opTab === 'delete' && (
                    <form onSubmit={handleDeleteSubmit} className="cl-form">
                        <div className="cl-form-row">
                            <div className="cl-form-group flex-2">
                                <label className="cl-form-label">Key to Delete</label>
                                <input
                                    type="text"
                                    className="cl-input"
                                    placeholder="e.g. user:1"
                                    value={deleteKey}
                                    onChange={(e) => setDeleteKey(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                className="cl-btn-danger cl-btn-submit"
                                disabled={loading || !deleteKey.trim()}
                            >
                                {loading ? 'Deleting…' : 'Execute DELETE'}
                            </button>
                        </div>

                        {deleteResult && (
                            <div className="cl-result-box del-result">
                                <div className="cl-result-header">
                                    <span className="cl-result-tag tag-del">DELETED</span>
                                    <span>{deleteResult}</span>
                                </div>
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};
