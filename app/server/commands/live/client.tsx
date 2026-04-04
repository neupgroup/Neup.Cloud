'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Clock, XCircle, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { initLiveSession, executeLiveCommand, endLiveSession } from './actions';

interface HistoryItem {
    time: string;
    type: 'command' | 'output';
    content: string;
}

export default function ClientTerminal({
    sessionId,
    serverId,
    serverName
}: {
    sessionId: string,
    serverId?: string,
    serverName: string
}) {
    const [input, setInput] = useState('');
    const [cwd, setCwd] = useState('~');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
    const [isEnded, setIsEnded] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Initialize Session
    useEffect(() => {
        initLiveSession(sessionId, serverId);
        // Focus input on load
        inputRef.current?.focus();
    }, [sessionId, serverId]);

    // Timer
    useEffect(() => {
        if (isEnded) return;
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    handleEndSession();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [sessionId, isEnded]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const handleEndSession = async () => {
        setIsEnded(true);
        await endLiveSession(sessionId, serverId);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !isProcessing && !isEnded && input.trim()) {
            const command = input;
            setInput('');
            setIsProcessing(true);

            if (command.trim().toLowerCase() === 'clear') {
                setHistory([]);
                setIsProcessing(false);
                setTimeout(() => inputRef.current?.focus(), 10);
                return;
            }

            const timestamp = new Date().toLocaleTimeString();

            // Add command to local history immediately
            setHistory(prev => [...prev, { time: timestamp, type: 'command', content: command }]);

            try {
                const result = await executeLiveCommand(sessionId, serverId, command);

                setCwd(result.cwd);
                const outTime = new Date().toLocaleTimeString();
                if (result.output) {
                    setHistory(prev => [...prev, { time: outTime, type: 'output', content: result.output }]);
                }
            } catch (err: any) {
                setHistory(prev => [...prev, { time: timestamp, type: 'output', content: `Error: ${err.message}` }]);
            } finally {
                setTimeLeft(15 * 60); // Reset timer to 15 minutes
                setIsProcessing(false);
                // Refocus input
                setTimeout(() => inputRef.current?.focus(), 10);
            }
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full w-full font-mono text-sm relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center text-green-400">
                        <Terminal className="w-4 h-4 mr-2" />
                        <span className="font-bold">{serverName}</span>
                    </div>
                    <div className="flex items-center text-zinc-500 text-xs">
                        <span className="mr-2">ID:</span>
                        <code className="bg-zinc-900 px-1 rounded text-zinc-300">{sessionId}</code>
                    </div>
                </div>

                <div className="flex items-center space-x-6">
                    <div className={`flex items-center font-bold px-3 py-1 rounded bg-zinc-900 ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-zinc-300'}`}>
                        <Clock className="w-4 h-4 mr-2" />
                        {formatTime(timeLeft)}
                    </div>

                    {!isEnded ? (
                        <button
                            onClick={handleEndSession}
                            className="flex items-center bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 px-3 py-1 rounded transition-colors"
                        >
                            <XCircle className="w-4 h-4 mr-2" />
                            End Session
                        </button>
                    ) : (
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center bg-green-900/20 hover:bg-green-900/40 text-green-500 border border-green-900/50 px-3 py-1 rounded transition-colors"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            New Session
                        </button>
                    )}
                </div>
            </div>

            {/* Terminal View */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto w-full space-y-1 pb-4"
                onClick={() => inputRef.current?.focus()}
            >
                <div className="text-zinc-500 mb-4">
                    Welcome to the Live Terminal.<br />
                    Context: {serverId ? 'Remote SSH Session' : 'Local Mock Environment'}.<br />
                    Session expires in 15 minutes.<br />
                    Type 'help' for available commands.<br />
                    --------------------------------------------------
                </div>

                {history.map((item, idx) => (
                    <div key={idx} className="flex flex-col animate-in fade-in duration-200">
                        {item.type === 'command' ? (
                            <div className="flex items-start text-white mt-2">
                                <span className="text-zinc-500 min-w-[80px] shrink-0 text-xs py-0.5">{item.time}</span>
                                <span className="text-green-500 font-bold mr-2">➜</span>
                                <span>{item.content}</span>
                            </div>
                        ) : (
                            <div className="flex items-start text-zinc-300">
                                <span className="text-zinc-600 min-w-[80px] shrink-0 text-xs py-0.5">{item.time}</span>
                                <pre className="whitespace-pre-wrap break-all font-mono opacity-90">{item.content}</pre>
                            </div>
                        )}
                    </div>
                ))}

                {!isEnded && (
                    <div className="flex items-center mt-2 group">
                        <div className="text-zinc-500 min-w-[80px] text-xs">Now</div>
                        <span className="text-blue-500 font-bold mr-2 ml-0">[{cwd}]$</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isProcessing}
                            className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-700 disabled:opacity-50"
                            placeholder={isProcessing ? "Executing..." : "Enter command..."}
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                        />
                    </div>
                )}

                {isEnded && (
                    <div className="mt-8 text-center text-zinc-500 border-t border-zinc-900 pt-4">
                        <p>Session Ended. Transcript saved.</p>
                        <p className="text-xs mt-2">Reload to start a new session.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
