'use client';

import React from 'react';
import { Card } from '#/components/ui/card';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Alert, AlertDescription } from '#/components/ui/alert';
import { Badge } from '#/components/ui/badge';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';
import type { DDoSTestProgress, DDoSTestResult } from '@/services/security/ddos-test';

interface DdosTestCardsProps {
  url: string;
  requestCount: number;
  waitForResponse: boolean;
  isRunning: boolean;
  completedRequests: number;
  progressPercentage: number;
  error: string;
  testResults: DDoSTestResult | null;
  liveProgress: DDoSTestProgress | null;
  onUrlChange: (value: string) => void;
  onRequestCountChange: (value: number) => void;
  onWaitForResponseChange: (value: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onClearResults: () => void;
}

export function DdosTestCards({
  url,
  requestCount,
  waitForResponse,
  isRunning,
  completedRequests,
  progressPercentage,
  error,
  testResults,
  liveProgress,
  onUrlChange,
  onRequestCountChange,
  onWaitForResponseChange,
  onStart,
  onStop,
  onClearResults,
}: DdosTestCardsProps) {
  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Vulnerability Testing</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Test your server&apos;s load bearing capacity by simulating concurrent requests.
              <span className="block mt-1 font-semibold text-amber-600">
                ⚠️ Note: Only perform tests on verified domains that you own.
              </span>
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Target URL</label>
            <Input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              disabled={isRunning}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Enter the full URL of the server you want to test (e.g., https://yourserver.com/api/health)
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Number of Requests</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="10000"
                value={requestCount}
                onChange={(e) => onRequestCountChange(Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1)))}
                disabled={isRunning}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">requests (1-10,000)</span>
            </div>
          </div>

          <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="waitForResponse"
                checked={waitForResponse}
                onChange={(e) => onWaitForResponseChange(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="waitForResponse" className="text-sm font-medium cursor-pointer">
                Wait for Response
              </label>
            </div>
            <p className="text-xs text-blue-800">
              {waitForResponse ? (
                <>
                  ✓ <strong>Controlled Mode:</strong> Max 10 concurrent requests. Waits for response from each request before sending next batch.
                  Provides accurate response times and realistic load testing. <strong>Recommended for production testing.</strong>
                </>
              ) : (
                <>
                  ✗ <strong>Fire-and-Forget Mode:</strong> Sends all requests immediately without waiting for responses.
                  Does not measure response times. Useful for stress testing server capability to handle connection floods.
                </>
              )}
            </p>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress</span>
                <Badge variant="secondary">
                  {completedRequests} / {requestCount}
                </Badge>
              </div>
              <progress
                className="h-2 w-full overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-blue-500 [&::-moz-progress-bar]:bg-blue-500"
                value={progressPercentage}
                max={100}
              />
            </div>
          )}

          {isRunning && liveProgress && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1 rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Last Response</p>
                <p className="text-lg font-semibold">{liveProgress.lastResponseTime}ms</p>
              </div>
              <div className="space-y-1 rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Avg Response</p>
                <p className="text-lg font-semibold">{liveProgress.averageResponseTime}ms</p>
              </div>
              <div className="space-y-1 rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Min Response</p>
                <p className="text-lg font-semibold">{liveProgress.minResponseTime}ms</p>
              </div>
              <div className="space-y-1 rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Max Response</p>
                <p className="text-lg font-semibold">{liveProgress.maxResponseTime}ms</p>
              </div>
              <div className="space-y-1 rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Blocked</p>
                <p className="text-lg font-semibold text-amber-600">{liveProgress.blockedRequests}</p>
              </div>
              <div className="space-y-1 rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Timeouts</p>
                <p className="text-lg font-semibold text-amber-600">{liveProgress.timeoutRequests}</p>
              </div>
              <div className="space-y-1 rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-lg font-semibold text-red-600">{liveProgress.failedRequests}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={onStart}
              disabled={isRunning}
              className="gap-2"
              size="lg"
            >
              <Zap className="h-4 w-4" />
              Start Test
            </Button>
            <Button
              onClick={onStop}
              disabled={!isRunning}
              type="solid"
              size="lg"
            >
              Stop Test
            </Button>
          </div>
        </div>
      </Card>

      {testResults && (
        <Card className="p-6 bg-slate-50">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {testResults.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-green-600">Test Completed Successfully</h3>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold text-amber-600">Test Completed with Issues</h3>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{testResults.totalRequests}</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{testResults.completedRequests}</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{testResults.failedRequests}</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-amber-600">{testResults.blockedRequests}</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {((testResults.completedRequests / testResults.totalRequests) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{testResults.averageResponseTime.toFixed(0)}ms</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Min Response</p>
                <p className="text-2xl font-bold">{testResults.minResponseTime}ms</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Max Response</p>
                <p className="text-2xl font-bold">{testResults.maxResponseTime}ms</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Total Duration</p>
                <p className="text-2xl font-bold">{(testResults.duration / 1000).toFixed(2)}s</p>
              </div>

              <div className="space-y-1 p-3 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">Timeouts</p>
                <p className="text-2xl font-bold text-amber-600">{testResults.timeoutRequests}</p>
              </div>
            </div>

            {Object.keys(testResults.statusCodes).length > 0 && (
              <div className="p-3 bg-white rounded-lg border space-y-2">
                <p className="text-sm font-semibold">HTTP Status Codes</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(testResults.statusCodes).map(([code, count]) => (
                    <div key={code} className="text-sm">
                      <span className={`font-bold ${
                        code.startsWith('2') ? 'text-green-600' :
                        code.startsWith('4') ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {code}:
                      </span>
                      {' '}<span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {testResults.errors.length > 0 && (
              <div className="p-3 bg-white rounded-lg border space-y-2">
                <p className="text-sm font-semibold text-red-600">Errors ({testResults.errors.length})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {testResults.errors.map((errorItem, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">• {errorItem}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button type="outlined" size="sm" onClick={onClearResults}>
                Clear Results
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">About Vulnerability Testing</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Tests up to 10,000 concurrent requests</li>
          <li>• Monitors response times and status codes</li>
          <li>• Provides detailed performance metrics</li>
          <li>• Requests are sent in batches for realistic testing</li>
          <li>• Currently in testing mode - enforce domain verification later</li>
        </ul>
      </Card>
    </>
  );
}
