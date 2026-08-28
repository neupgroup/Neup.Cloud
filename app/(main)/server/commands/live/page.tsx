'use client';

import { Clock, Play, Terminal, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { getServer } from '@/services/server/server-service';
import { endLiveSession, executeLiveCommand, initLiveSession } from '@/services/server/live-command';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { useServerName } from '@/hooks/use-server-name';
import { Button } from '#/components/ui/button';
import { getWildcardCertificateSession, verifyWildcardCertificateSession } from '@/services/webservices/nginx/service';

interface HistoryItem {
  time: string;
  type: 'command' | 'output';
  content: string;
}

function getOrCreateSessionId(storageKey: string) {
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next = Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return Math.random().toString(36).substring(2, 10);
  }
}

export default function LiveConsolePage() {
  const searchParams = useSearchParams();
  const serverId = useSelectedServerId();
  const resolvedServerName = useServerName();
  const requestedSessionId = searchParams.get('sessionId')?.trim() || null;
  const acmeMode = searchParams.get('acme') === '1';

  const sessionId = useMemo(() => {
    if (requestedSessionId) {
      return requestedSessionId;
    }

    const key = `neup:commands:live-session-id:${serverId ?? 'local'}`;
    return getOrCreateSessionId(key);
  }, [requestedSessionId, serverId]);

  const [serverName, setServerName] = useState(resolvedServerName || 'Mock Server');
  const [acmeSession, setAcmeSession] = useState<Awaited<ReturnType<typeof getWildcardCertificateSession>>>(null);

  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('~');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [isEnded, setIsEnded] = useState(false);
  const [isVerifyingAcme, setIsVerifyingAcme] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resolvedServerName) {
      setServerName(resolvedServerName);
      return;
    }
    if (!serverId || resolvedServerName) return;
    getServer(serverId)
      .then((server) => {
        if (server?.name) setServerName(server.name);
      })
      .catch(() => {});
  }, [resolvedServerName, serverId]);

  useEffect(() => {
    initLiveSession(sessionId, serverId ?? undefined);
    inputRef.current?.focus();
  }, [sessionId, serverId]);

  useEffect(() => {
    if (!acmeMode) {
      setAcmeSession(null);
      return;
    }

    getWildcardCertificateSession(sessionId)
      .then((session) => {
        setAcmeSession(session);
      })
      .catch(() => {
        setAcmeSession(null);
      });
  }, [acmeMode, sessionId]);

  useEffect(() => {
    if (isEnded) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          void handleEndSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, isEnded]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleEndSession = async () => {
    setIsEnded(true);
    await endLiveSession(sessionId);
  };

  const handleVerifyAcme = async () => {
    if (!acmeMode || isVerifyingAcme) {
      return;
    }

    setIsVerifyingAcme(true);
    const timestamp = new Date().toLocaleTimeString();
    setHistory((prev) => [
      ...prev,
      { time: timestamp, type: 'output', content: 'Starting ACME DNS verification...' },
    ]);

    try {
      const result = await verifyWildcardCertificateSession(sessionId);
      const nextTime = new Date().toLocaleTimeString();
      if (result.success) {
        setHistory((prev) => [
          ...prev,
          { time: nextTime, type: 'output', content: result.message || 'Wildcard certificate verified successfully.' },
        ]);
      } else {
        setHistory((prev) => [
          ...prev,
          { time: nextTime, type: 'output', content: result.error || 'Wildcard certificate verification failed.' },
        ]);
      }

      const nextSession = await getWildcardCertificateSession(sessionId);
      setAcmeSession(nextSession);
    } catch (err: any) {
      const nextTime = new Date().toLocaleTimeString();
      setHistory((prev) => [
        ...prev,
        { time: nextTime, type: 'output', content: `Verification error: ${err.message}` },
      ]);
    } finally {
      setIsVerifyingAcme(false);
      setTimeLeft(15 * 60);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (isProcessing || isEnded) return;
    if (!input.trim()) return;

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
    setHistory((prev) => [...prev, { time: timestamp, type: 'command', content: command }]);

    try {
      const result = await executeLiveCommand(sessionId, serverId ?? undefined, command);
      setCwd(result.cwd);
      const outTime = new Date().toLocaleTimeString();
      if (result.output) {
        setHistory((prev) => [...prev, { time: outTime, type: 'output', content: result.output }]);
      }
    } catch (err: any) {
      setHistory((prev) => [...prev, { time: timestamp, type: 'output', content: `Error: ${err.message}` }]);
    } finally {
      setTimeLeft(15 * 60);
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-zinc-950 text-green-500 font-mono text-sm p-4 rounded-lg border border-zinc-800 shadow-2xl overflow-hidden">
      <div className="flex flex-col h-full w-full font-mono text-sm relative">
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
            {acmeMode && acmeSession && !isEnded ? (
              <Button
                onClick={handleVerifyAcme}
                disabled={isVerifyingAcme || acmeSession.status === 'completed'}
                className="flex items-center bg-blue-900/20 hover:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 border border-blue-900/50 px-3 py-1 rounded transition-colors"
              >
                <Play className="w-4 h-4 mr-2" />
                {isVerifyingAcme ? 'Verifying ACME...' : 'Verify ACME Challenge'}
              </Button>
            ) : null}

            <div
              className={`flex items-center font-bold px-3 py-1 rounded bg-zinc-900 ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-zinc-300'}`}
            >
              <Clock className="w-4 h-4 mr-2" />
              {formatTime(timeLeft)}
            </div>

            {!isEnded ? (
              <Button
                onClick={handleEndSession}
                className="flex items-center bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 px-3 py-1 rounded transition-colors"
              >
                <XCircle className="w-4 h-4 mr-2" />
                End Session
              </Button>
            ) : (
              <Button
                onClick={() => window.location.reload()}
                className="flex items-center bg-green-900/20 hover:bg-green-900/40 text-green-500 border border-green-900/50 px-3 py-1 rounded transition-colors"
              >
                <Play className="w-4 h-4 mr-2" />
                New Session
              </Button>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto w-full space-y-1 pb-4"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="text-zinc-500 mb-4">
            Welcome to the Live Terminal.
            <br />
            Context: {serverId ? 'Remote SSH Session' : 'Local Mock Environment'}.
            <br />
            Session expires in 15 minutes.
            <br />
            Type 'help' for available commands.
            <br />
            --------------------------------------------------
          </div>

          {acmeMode && acmeSession ? (
            <div className="mb-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
              <div className="font-semibold">Wildcard ACME session</div>
              <div className="text-xs mt-1">Status: {acmeSession.status}</div>
              <div className="text-xs">Record: {acmeSession.dnsRecord}</div>
              <div className="text-xs break-all">Value: {acmeSession.challenge}</div>
              {acmeSession.message ? <div className="text-xs mt-1">{acmeSession.message}</div> : null}
            </div>
          ) : null}

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
                placeholder={isProcessing ? 'Executing...' : 'Enter command...'}
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
    </div>
  );
}
