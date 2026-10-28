import React, { useState, useEffect, useRef } from 'react';

interface TutorialStep {
    stepIndex: number;
    title: string;
    action: string;
    operationType: 'INIT' | 'PUT' | 'GET' | 'EVICT';
    description: string;
    whatHappened: string;
    whyOrderChanged: string;
    entries: { key: string; value: string; isLru: boolean; isMru: boolean }[];
    evictedKey?: string;
    highlightKey?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        stepIndex: 1,
        title: 'Step 1: Initialize Cache (Capacity = 3)',
        action: 'Cache created with fixed capacity of 3 slots',
        operationType: 'INIT',
        description: 'We allocate an LRU cache that can store at most 3 items in memory.',
        whatHappened: 'Both the hash map and doubly linked list are initially empty.',
        whyOrderChanged: 'No items have been touched or inserted yet.',
        entries: [],
    },
    {
        stepIndex: 2,
        title: 'Step 2: Insert A = 10',
        action: 'PUT(key="A", value="10")',
        operationType: 'PUT',
        description: 'First insertion into the empty cache.',
        whatHappened: 'A node for (A, 10) is created and placed in the linked list. A reference is saved in the hash map.',
        whyOrderChanged: 'Since A is the only entry in the cache, it is currently BOTH the Most Recently Used (MRU) and Least Recently Used (LRU).',
        entries: [
            { key: 'A', value: '10', isLru: true, isMru: true },
        ],
        highlightKey: 'A',
    },
    {
        stepIndex: 3,
        title: 'Step 3: Insert B = 20',
        action: 'PUT(key="B", value="20")',
        operationType: 'PUT',
        description: 'Second item added to the cache.',
        whatHappened: 'Node (B, 20) is placed at the MRU tail. Node A remains at the LRU head.',
        whyOrderChanged: 'B was just touched right now, so B becomes MRU. A has not been accessed since step 2, so A stays LRU.',
        entries: [
            { key: 'A', value: '10', isLru: true, isMru: false },
            { key: 'B', value: '20', isLru: false, isMru: true },
        ],
        highlightKey: 'B',
    },
    {
        stepIndex: 4,
        title: 'Step 4: Insert C = 30 (Cache is now FULL)',
        action: 'PUT(key="C", value="30")',
        operationType: 'PUT',
        description: 'Third item added. The cache now holds 3 / 3 items.',
        whatHappened: 'Node (C, 30) is added to the MRU tail. Capacity limit is now reached.',
        whyOrderChanged: 'C is newest (MRU), then B, and A is oldest (LRU). Any new item inserted next will require evicting an existing item!',
        entries: [
            { key: 'A', value: '10', isLru: true, isMru: false },
            { key: 'B', value: '20', isLru: false, isMru: false },
            { key: 'C', value: '30', isLru: false, isMru: true },
        ],
        highlightKey: 'C',
    },
    {
        stepIndex: 5,
        title: 'Step 5: Access A (GET "A") — The Recency Shift!',
        action: 'GET(key="A") ⟶ Returns 10 (CACHE HIT)',
        operationType: 'GET',
        description: 'A user looks up key "A". Watch what happens to the order!',
        whatHappened: 'Key "A" is found in O(1) via the hash map. It is unlinked from the front and spliced to the MRU tail!',
        whyOrderChanged: 'Because A was just accessed, it is NO LONGER the oldest! B now becomes the oldest item (LRU). Order is now B ⇄ C ⇄ A.',
        entries: [
            { key: 'B', value: '20', isLru: true, isMru: false },
            { key: 'C', value: '30', isLru: false, isMru: false },
            { key: 'A', value: '10', isLru: false, isMru: true },
        ],
        highlightKey: 'A',
    },
    {
        stepIndex: 6,
        title: 'Step 6: Insert D = 40 (Eviction in Action!)',
        action: 'PUT(key="D", value="40") ⟶ Evicts "B"',
        operationType: 'EVICT',
        description: 'Cache is full (3/3), but we must store D. Who gets kicked out?',
        whatHappened: 'The cache checks the LRU position. B is at the head! B is popped in O(1) and erased from the map. D is placed at MRU.',
        whyOrderChanged: 'Even though A was inserted before B, A was recently used in Step 5! B was neglected the longest, so B was evicted. Order: C ⇄ A ⇄ D.',
        entries: [
            { key: 'C', value: '30', isLru: true, isMru: false },
            { key: 'A', value: '10', isLru: false, isMru: false },
            { key: 'D', value: '40', isLru: false, isMru: true },
        ],
        evictedKey: 'B',
        highlightKey: 'D',
    },
    {
        stepIndex: 7,
        title: 'Step 7: Key Takeaways & Core Invariants',
        action: 'Simulation Complete',
        operationType: 'INIT',
        description: 'Congratulations! You now understand the fundamental mechanics of LRU caching.',
        whatHappened: 'Throughout all 6 operations, every GET, PUT, and eviction executed in average O(1) time complexity.',
        whyOrderChanged: 'By combining a Hash Map for O(1) lookup with a Doubly Linked List for O(1) node splicing, we maintain perfect temporal locality.',
        entries: [
            { key: 'C', value: '30', isLru: true, isMru: false },
            { key: 'A', value: '10', isLru: false, isMru: false },
            { key: 'D', value: '40', isLru: false, isMru: true },
        ],
    },
];

export const LearnMode: React.FC = () => {
    const [learnSection, setLearnSection] = useState<'tutorial' | 'concepts' | 'structures' | 'faq'>('tutorial');
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const step = TUTORIAL_STEPS[currentStepIndex];

    const handleNext = () => {
        if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            setIsPlaying(false);
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((prev) => prev - 1);
        }
    };

    const handleRestart = () => {
        setCurrentStepIndex(0);
        setIsPlaying(false);
    };

    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
        } else {
            if (currentStepIndex === TUTORIAL_STEPS.length - 1) {
                setCurrentStepIndex(0);
            }
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        if (isPlaying) {
            timerRef.current = setInterval(() => {
                setCurrentStepIndex((prev) => {
                    if (prev >= TUTORIAL_STEPS.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 3000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying]);

    return (
        <div className="cl-learn-wrapper">
            {/* Learn Subnavigation Bar */}
            <div className="cl-learn-nav">
                <button
                    className={`cl-learn-nav-btn ${learnSection === 'tutorial' ? 'active' : ''}`}
                    onClick={() => setLearnSection('tutorial')}
                >
                    🎬 Interactive Simulation
                </button>
                <button
                    className={`cl-learn-nav-btn ${learnSection === 'concepts' ? 'active' : ''}`}
                    onClick={() => setLearnSection('concepts')}
                >
                    📖 What is LRU? (ELI5)
                </button>
                <button
                    className={`cl-learn-nav-btn ${learnSection === 'structures' ? 'active' : ''}`}
                    onClick={() => setLearnSection('structures')}
                >
                    🏗️ Why 2 Data Structures?
                </button>
                <button
                    className={`cl-learn-nav-btn ${learnSection === 'faq' ? 'active' : ''}`}
                    onClick={() => setLearnSection('faq')}
                >
                    💡 FAQ & Real World Use
                </button>
            </div>

            {/* SECTION 1: INTERACTIVE STEP-BY-STEP SIMULATION */}
            {learnSection === 'tutorial' && (
                <div className="cl-tutorial-container">
                    {/* Stepper Progress Bar */}
                    <div className="cl-stepper-progress">
                        {TUTORIAL_STEPS.map((s, idx) => (
                            <button
                                key={s.stepIndex}
                                className={`cl-step-bubble ${idx === currentStepIndex ? 'active' : idx < currentStepIndex ? 'completed' : ''}`}
                                onClick={() => {
                                    setCurrentStepIndex(idx);
                                    setIsPlaying(false);
                                }}
                                title={s.title}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>

                    {/* Step Card */}
                    <div className="cl-card cl-tutorial-card">
                        <div className="cl-card-header">
                            <div className="cl-card-title-box">
                                <span className="cl-step-number-tag">Step {step.stepIndex} of {TUTORIAL_STEPS.length}</span>
                                <h3 className="cl-card-title">{step.title}</h3>
                            </div>

                            <div className="cl-tutorial-controls">
                                <button
                                    className="cl-btn-ghost-sm"
                                    onClick={handleRestart}
                                    title="Start over from Step 1"
                                >
                                    ⏮ Restart
                                </button>
                                <button
                                    className="cl-btn-ghost-sm"
                                    onClick={handlePrev}
                                    disabled={currentStepIndex === 0}
                                    title="Previous step"
                                >
                                    ◀ Previous
                                </button>
                                <button
                                    className={`cl-btn-primary cl-btn-play ${isPlaying ? 'playing' : ''}`}
                                    onClick={togglePlay}
                                    title={isPlaying ? 'Pause automatic walkthrough' : 'Play automatic walkthrough'}
                                >
                                    {isPlaying ? '⏸ Pause' : '▶ Auto-Play'}
                                </button>
                                <button
                                    className="cl-btn-primary"
                                    onClick={handleNext}
                                    disabled={currentStepIndex === TUTORIAL_STEPS.length - 1}
                                    title="Next step"
                                >
                                    Next Step ▶
                                </button>
                            </div>
                        </div>

                        {/* Visual Simulation Strip */}
                        <div className="cl-tutorial-canvas">
                            <div className="cl-canvas-meta-bar">
                                <span className="cl-action-badge font-mono">{step.action}</span>
                                <span className="cl-capacity-indicator">
                                    Capacity: <strong>{step.entries.length} / 3</strong>
                                </span>
                            </div>

                            <div className="cl-linked-list-track">
                                {step.evictedKey && (
                                    <div className="cl-evicted-ghost-wrapper">
                                        <div className="cl-node-card evicted-animation">
                                            <div className="cl-node-tag tag-evicted">EVICTED</div>
                                            <div className="cl-node-key">{step.evictedKey}</div>
                                            <div className="cl-node-val">popped</div>
                                        </div>
                                        <div className="cl-evict-arrow">⤳ Evicted (LRU)</div>
                                    </div>
                                )}

                                <div className="cl-sentinel-box">
                                    <span className="cl-sentinel-label">HEAD</span>
                                    <span className="cl-sentinel-null">nullptr</span>
                                    <span className="cl-sentinel-pointer">⟵ prev</span>
                                </div>

                                {step.entries.length === 0 ? (
                                    <div className="cl-canvas-empty-hint">[ Cache is empty — no nodes in list ]</div>
                                ) : (
                                    step.entries.map((item, idx) => {
                                        const isHighlight = step.highlightKey === item.key;
                                        return (
                                            <React.Fragment key={item.key}>
                                                <div
                                                    className={`cl-node-card ${isHighlight ? 'node-hit' : ''} ${item.isLru ? 'is-lru' : ''} ${item.isMru ? 'is-mru' : ''}`}
                                                >
                                                    <div className="cl-node-header">
                                                        <span className="cl-node-rank">#{idx + 1}</span>
                                                        {item.isLru && <span className="cl-node-tag tag-lru">LRU (Oldest)</span>}
                                                        {item.isMru && <span className="cl-node-tag tag-mru">MRU (Newest)</span>}
                                                        {!item.isLru && !item.isMru && (
                                                            <span className="cl-node-tag tag-mid">Slot {idx + 1}</span>
                                                        )}
                                                    </div>

                                                    <div className="cl-node-body">
                                                        <div className="cl-node-field">
                                                            <span className="cl-field-label">Key</span>
                                                            <span className="cl-node-key">{item.key}</span>
                                                        </div>
                                                        <div className="cl-node-field">
                                                            <span className="cl-field-label">Value</span>
                                                            <span className="cl-node-val">{item.value}</span>
                                                        </div>
                                                    </div>

                                                    <div className="cl-node-pointers">
                                                        <span className="cl-ptr left">← prev</span>
                                                        <span className="cl-ptr-divider">|</span>
                                                        <span className="cl-ptr right">next →</span>
                                                    </div>
                                                </div>

                                                {idx < step.entries.length - 1 && (
                                                    <div className="cl-link-connector">
                                                        <div className="cl-link-arrow">⇄</div>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}

                                <div className="cl-sentinel-box">
                                    <span className="cl-sentinel-label">TAIL</span>
                                    <span className="cl-sentinel-null">nullptr</span>
                                    <span className="cl-sentinel-pointer">next ⟶</span>
                                </div>
                            </div>
                        </div>

                        {/* Step Details & Explanation Box */}
                        <div className="cl-step-explanation-box">
                            <div className="cl-exp-column">
                                <h4 className="cl-exp-title">🛠️ What Happened</h4>
                                <p className="cl-exp-text">{step.whatHappened}</p>
                            </div>
                            <div className="cl-exp-column">
                                <h4 className="cl-exp-title">🧠 Why The Recency Order Changed</h4>
                                <p className="cl-exp-text">{step.whyOrderChanged}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 2: CORE CONCEPTS (ELI5) */}
            {learnSection === 'concepts' && (
                <div className="cl-concepts-grid">
                    <div className="cl-card">
                        <div className="cl-card-header">
                            <h3 className="cl-card-title">1. What is a Cache?</h3>
                        </div>
                        <div className="cl-card-body cl-prose">
                            <p>
                                Imagine you are a chef cooking in a busy kitchen. If every single time you needed salt, pepper, or olive oil you had to walk down to the basement storage pantry, dinner would take 3 hours!
                            </p>
                            <p>
                                Instead, you keep a small <strong>prep table right next to your stove</strong> with the ingredients you use most often.
                            </p>
                            <div className="cl-analogy-box">
                                <div className="cl-analogy-item">
                                    <strong>Basement Storage / Database:</strong> Giant capacity, but slow to access (e.g. 50–100ms disk/network).
                                </div>
                                <div className="cl-analogy-item">
                                    <strong>Prep Table / Cache:</strong> Small capacity, but ultra-fast to access (e.g. 50 nanoseconds in RAM).
                                </div>
                            </div>
                            <p>
                                In computer systems, a <strong>Cache</strong> is that ultra-fast prep table in RAM.
                            </p>
                        </div>
                    </div>

                    <div className="cl-card">
                        <div className="cl-card-header">
                            <h3 className="cl-card-title">2. What is LRU? (Least Recently Used)</h3>
                        </div>
                        <div className="cl-card-body cl-prose">
                            <p>
                                Your prep table has limited room: say it only holds <strong>5 bottles</strong>. What happens when you need to bring a 6th bottle to the table?
                            </p>
                            <p>
                                You have to remove one bottle to make space. But which one?
                            </p>
                            <p>
                                <strong>LRU (Least Recently Used)</strong> answers this with common sense:
                            </p>
                            <blockquote className="cl-quote">
                                "Remove the item that hasn't been touched for the longest time."
                            </blockquote>
                            <p>
                                If you reached for Garlic salt 2 seconds ago and Olive oil 10 seconds ago, but haven't touched Truffle oil for 45 minutes, Truffle oil gets put back in the pantry!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 3: WHY 2 DATA STRUCTURES? */}
            {learnSection === 'structures' && (
                <div className="cl-structures-container">
                    <div className="cl-card">
                        <div className="cl-card-header">
                            <h3 className="cl-card-title">The Engineering Puzzle: Why We Need Both a Hash Map AND a Doubly Linked List</h3>
                        </div>
                        <div className="cl-card-body cl-prose">
                            <p>
                                In computer science interviews and production systems, the classic question is:
                                <em> "Can you build an LRU cache where GET, PUT, and EVICT all run in O(1) time?"</em>
                            </p>

                            <div className="cl-ds-comparison-grid">
                                <div className="cl-ds-column fail">
                                    <h4>Attempt 1: Hash Map Only</h4>
                                    <ul>
                                        <li>✅ <code>map.find(key)</code> is O(1) average lookup!</li>
                                        <li>❌ <strong>Hash maps have NO order.</strong> They cannot tell you which key is the oldest without scanning through every single key (which takes O(n) time).</li>
                                    </ul>
                                </div>

                                <div className="cl-ds-column fail">
                                    <h4>Attempt 2: Doubly Linked List Only</h4>
                                    <ul>
                                        <li>✅ Front/Back popping and splicing is O(1)!</li>
                                        <li>❌ <strong>Finding a key takes O(n).</strong> You have to walk down the list node-by-node from the start to find a key.</li>
                                    </ul>
                                </div>

                                <div className="cl-ds-column success">
                                    <h4>The Solution: Hash Map + Doubly Linked List</h4>
                                    <ul>
                                        <li>
                                            <code>std::unordered_map&lt;Key, list::iterator&gt;</code> stores pointers directly to the node!
                                        </li>
                                        <li>
                                            <strong>Lookup:</strong> Hash map finds the node pointer in <strong>O(1)</strong>.
                                        </li>
                                        <li>
                                            <strong>Promote:</strong> <code>list.splice()</code> unlinks the node and moves it to the MRU tail in <strong>O(1)</strong>!
                                        </li>
                                        <li>
                                            <strong>Evict:</strong> <code>list.pop_front()</code> removes the LRU head in <strong>O(1)</strong>!
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="cl-card">
                        <div className="cl-card-header">
                            <h3 className="cl-card-title">Time & Space Complexity Summary</h3>
                        </div>
                        <div className="cl-table-responsive">
                            <table className="cl-entries-table">
                                <thead>
                                    <tr>
                                        <th>Operation</th>
                                        <th>Complexity</th>
                                        <th>Mechanism</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><code>GET(key)</code></td>
                                        <td><strong className="text-emerald">O(1) average</strong></td>
                                        <td>Hash map lookup ⟶ <code>std::list::splice</code> to MRU</td>
                                    </tr>
                                    <tr>
                                        <td><code>PUT(key, value)</code> [New]</td>
                                        <td><strong className="text-emerald">O(1) average</strong></td>
                                        <td>If full: evict LRU (O(1)) ⟶ <code>emplace_back</code> to MRU ⟶ save in map</td>
                                    </tr>
                                    <tr>
                                        <td><code>PUT(key, value)</code> [Update]</td>
                                        <td><strong className="text-emerald">O(1) average</strong></td>
                                        <td>Update value in-place ⟶ <code>std::list::splice</code> to MRU</td>
                                    </tr>
                                    <tr>
                                        <td><code>DELETE(key)</code></td>
                                        <td><strong className="text-emerald">O(1) average</strong></td>
                                        <td>Hash map find ⟶ <code>list.erase(node)</code> ⟶ <code>map.erase(key)</code></td>
                                    </tr>
                                    <tr>
                                        <td><code>Space Complexity</code></td>
                                        <td><strong className="text-cyan">O(Capacity)</strong></td>
                                        <td>At most N nodes and N map entries allocated in memory</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 4: FAQ & REAL WORLD USE */}
            {learnSection === 'faq' && (
                <div className="cl-faq-container">
                    <div className="cl-card">
                        <div className="cl-card-header">
                            <h3 className="cl-card-title">🌍 Where is LRU Used in the Real World?</h3>
                        </div>
                        <div className="cl-card-body cl-prose">
                            <div className="cl-use-cases-grid">
                                <div className="cl-use-case">
                                    <h4>🌐 Web Browsers (Chrome / Safari)</h4>
                                    <p>
                                        When you navigate between pages, images, JavaScript bundles, and CSS stylesheets are kept in an LRU memory cache so pressing "Back" loads instantly without re-downloading from the internet.
                                    </p>
                                </div>

                                <div className="cl-use-case">
                                    <h4>☁️ Content Delivery Networks (Cloudflare / CloudFront)</h4>
                                    <p>
                                        Edge servers cache popular video segments and API responses close to users. Inactive content is evicted using LRU variants to free up terabytes of SSD cache.
                                    </p>
                                </div>

                                <div className="cl-use-case">
                                    <h4>🗄️ Database Buffer Pools (MySQL InnoDB / PostgreSQL)</h4>
                                    <p>
                                        Databases maintain an LRU buffer pool in RAM of recent 16KB disk pages. Queries hitting cached pages return in microseconds rather than waiting on mechanical disk reads.
                                    </p>
                                </div>

                                <div className="cl-use-case">
                                    <h4>💻 Operating System Page Replacement</h4>
                                    <p>
                                        When your physical RAM fills up, the OS kernel uses LRU approximations (Clock algorithm) to swap the least recently used virtual memory pages to swap space on disk.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="cl-card">
                        <div className="cl-card-header">
                            <h3 className="cl-card-title">❓ Frequently Asked Questions (FAQ)</h3>
                        </div>
                        <div className="cl-card-body cl-faq-list">
                            <div className="cl-faq-item">
                                <div className="cl-faq-q">Q: What happens if I perform a GET on a key that doesn't exist?</div>
                                <div className="cl-faq-a">
                                    A: It counts as a <strong>Cache Miss</strong>. The cache leaves the order of all existing elements completely unchanged and increments the miss counter.
                                </div>
                            </div>

                            <div className="cl-faq-item">
                                <div className="cl-faq-q">Q: Does updating an existing key's value trigger an eviction?</div>
                                <div className="cl-faq-a">
                                    A: No! Because the key already exists, the total number of items in the cache does not increase. The value is updated in place, and the key is moved to the MRU position.
                                </div>
                            </div>

                            <div className="cl-faq-item">
                                <div className="cl-faq-q">Q: Why use a doubly linked list instead of a singly linked list?</div>
                                <div className="cl-faq-a">
                                    A: In a singly linked list, removing a node requires finding its predecessor, which takes O(n) traversal. A doubly linked list node has a <code>prev</code> pointer, allowing O(1) unlinking without traversing!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
