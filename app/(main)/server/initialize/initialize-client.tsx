'use client';

/*
::neup.documentation::server-initialize-client
::title Server Initialize Client

Client-side stepper for the server initialization workflow.

::public

Shows port, application launcher, and status logger checks for the selected
server.

::public end

::private

The client invokes server actions for read-only checks and keeps continuation
state local to the page.

::private end

::end
*/

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCcw, Rocket, ShieldCheck, Signal, XCircle } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#/components/ui/card';
import { Progress } from '#/components/ui/progress';
import { cn } from '@/core/utils';
import {
  checkInitializeApplicationLauncher,
  checkInitializePorts,
  checkInitializeStatusLogger,
  installInitializeRequirement,
  repairInitializeRequirement,
  type InitializeApplicationLauncherChecks,
  type InitializeInstallTarget,
  type InitializeInstallationCheck,
  type InitializeMode,
  type InitializePortCheck,
} from '@/services/server/initialize-service';

type InitializeClientProps = {
  serverId?: string | null;
  serverName?: string | null;
  mode: InitializeMode;
};

type StepId = 'ports' | 'launcher' | 'logger';

const ports = [80, 443, 25, 5432] as const;
const totalSteps = 4;

const defaultInstallationCheck = (title: string, message = 'Not checked yet.'): InitializeInstallationCheck => ({
  checked: false,
  installed: false,
  status: 'not_installed',
  title,
  message,
});

const defaultLauncherChecks = (): InitializeApplicationLauncherChecks => ({
  pm2: defaultInstallationCheck('PM2'),
  supervisor: defaultInstallationCheck('Supervisor'),
});

function PortStatusIcon({ status }: { status?: InitializePortCheck['status'] }) {
  if (!status) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === 'open') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'error') return <AlertCircle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-red-600" />;
}

function statusLabel(status?: InitializePortCheck['status']) {
  if (!status) return 'checking...';
  if (status === 'open') return 'open';
  if (status === 'blocked') return 'blocked';
  if (status === 'closed') return 'closed';
  return 'error';
}

function hasLauncherCheckCompleted(checks: InitializeApplicationLauncherChecks) {
  return checks.pm2.checked || checks.supervisor.checked;
}

function StepShell({
  active,
  title,
  description,
  children,
}: {
  active: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden', active ? 'border-primary/60 shadow-sm' : 'opacity-75')}>
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export function InitializeClient({ serverId, serverName, mode }: InitializeClientProps) {
  const [currentStep, setCurrentStep] = useState<StepId>('ports');
  const [portChecks, setPortChecks] = useState<InitializePortCheck[]>([]);
  const [launcherChecks, setLauncherChecks] = useState<InitializeApplicationLauncherChecks>(() => defaultLauncherChecks());
  const [loggerCheck, setLoggerCheck] = useState<InitializeInstallationCheck>(() => defaultInstallationCheck('Status logger'));
  const [error, setError] = useState<string | null>(null);
  const [isChecking, startChecking] = useTransition();
  const [isInstalling, startInstalling] = useTransition();
  const [installingTarget, setInstallingTarget] = useState<InitializeInstallTarget | null>(null);

  const checkedPorts = useMemo(() => new Map(portChecks.map((check) => [check.port, check])), [portChecks]);
  const portsChecked = portChecks.length === ports.length;
  const portsCheckCompleted = portChecks.length > 0;
  const launcherCheckCompleted = hasLauncherCheckCompleted(launcherChecks);
  const currentStepNumber = currentStep === 'ports' ? 1 : currentStep === 'launcher' ? 2 : 3;
  const progress = Math.round((currentStepNumber / totalSteps) * 100);
  const isCheckingPorts = isChecking && currentStep === 'ports';
  const isCheckingLauncher = isChecking && currentStep === 'launcher';
  const isCheckingLogger = isChecking && currentStep === 'logger';

  const runCurrentStep = (step: StepId = currentStep) => {
    if (!serverId) {
      setError('Select a server before running initialization checks.');
      return;
    }

    setError(null);
    startChecking(async () => {
      try {
        if (step === 'ports') {
          const result = await checkInitializePorts(serverId);
          setPortChecks(result);
          return;
        }

        if (step === 'launcher') {
          if (!hasLauncherCheckCompleted(launcherChecks)) {
            setLauncherChecks({
              pm2: defaultInstallationCheck('PM2', 'Checking PM2...'),
              supervisor: defaultInstallationCheck('Supervisor', 'Checking Supervisor...'),
            });
          }
          setLauncherChecks(await checkInitializeApplicationLauncher(serverId));
          return;
        }

        if (!loggerCheck.checked) {
          setLoggerCheck(defaultInstallationCheck('Status logger', 'Checking status logger...'));
        }
        setLoggerCheck(await checkInitializeStatusLogger(serverId));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Initialization check failed.');
      }
    });
  };

  useEffect(() => {
    if (serverId) {
      runCurrentStep('ports');
    }
  }, [serverId]);

  const continueToLauncher = () => {
    setCurrentStep('launcher');
    runCurrentStep('launcher');
  };

  const continueToLogger = () => {
    setCurrentStep('logger');
    runCurrentStep('logger');
  };

  const isRepairMode = mode === 'repair';

  const handleInstall = (target: InitializeInstallTarget, step: StepId) => {
    if (!serverId) {
      setError('Select a server before installing requirements.');
      return;
    }

    setError(null);
    setInstallingTarget(target);
    startInstalling(async () => {
      try {
        const result = target === 'system-logger' && isRepairMode
          ? await repairInitializeRequirement(serverId, target)
          : await installInitializeRequirement(serverId, target);
        if (!result.success) {
          setError(result.message);
          return;
        }

        runCurrentStep(step);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Installation failed.');
      } finally {
        setInstallingTarget(null);
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            Initialize Server
          </span>
        }
        description={isRepairMode
          ? 'Repair the selected server setup by re-running the key initialization steps.'
          : 'Before continuing, complete these checks so your journey gets easier with the server.'}
        serverName={serverName}
      />

      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">Step {currentStepNumber} of {totalSteps}</div>
        <Progress value={progress} className="h-2" />
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </Card>
      ) : null}

      {!serverId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a server</CardTitle>
            <CardDescription>Choose a server before running initialization checks.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/server/list">Select server</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {currentStep === 'ports' ? (
        <StepShell
          active
          title="Check required ports"
          description="Check and see if every port you need are open or not."
        >
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ports.map((port) => {
                const check = checkedPorts.get(port);
                return (
                  <div key={port} className="rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Port</div>
                        <div className="text-2xl font-semibold">{port}</div>
                      </div>
                      <PortStatusIcon status={check?.status} />
                    </div>
                    <div className="mt-3 text-sm font-medium">port {port} {statusLabel(check?.status)}</div>
                    {isCheckingPorts ? <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    <div className="mt-1 min-h-10 text-xs text-muted-foreground">
                      {check?.message ?? 'Checking port availability...'}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-between">
            {portsCheckCompleted ? (
              <Button type="button" variant="outline" onClick={() => runCurrentStep('ports')} disabled={!serverId || isChecking}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reload
              </Button>
            ) : <div />}
            <Button type="button" onClick={continueToLauncher} disabled={!serverId || !portsChecked || isChecking}>
              Continue
            </Button>
          </CardFooter>
        </StepShell>
      ) : null}

      {currentStep === 'launcher' ? (
        <StepShell
          active
          title="Application launcher"
          description="Check the app used to keep launched applications running. You can continue even when it is not installed."
        >
          <CardContent className="space-y-4 pt-6">
            {([
              ['pm2', launcherChecks.pm2],
              ['supervisor', launcherChecks.supervisor],
            ] as const).map(([key, check]) => (
              <div key={key} className="flex items-start gap-3 rounded-lg border bg-background p-4">
                <Signal className={cn('mt-0.5 h-5 w-5', check.installed ? 'text-emerald-600' : 'text-amber-600')} />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{check.title}</span>
                    {isCheckingLauncher ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  </div>
                  <div className="text-sm text-muted-foreground">{check.message}</div>
                </div>
                {check.checked && !check.installed ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleInstall(key, 'launcher')}
                    disabled={!serverId || isInstalling}
                  >
                    {isInstalling && installingTarget === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Install
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-between">
            {launcherCheckCompleted ? (
              <Button type="button" variant="outline" onClick={() => runCurrentStep('launcher')} disabled={!serverId || isChecking || isInstalling}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reload
              </Button>
            ) : <div />}
            <Button type="button" onClick={continueToLogger} disabled={!serverId || isChecking || isInstalling}>
              Continue
            </Button>
          </CardFooter>
        </StepShell>
      ) : null}

      {currentStep === 'logger' ? (
        <StepShell
          active
          title="Status logging application"
          description={isRepairMode
            ? 'Repair the status logger by removing the current setup and installing it again.'
            : 'Check for the installation of the status logging application.'}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
              <ShieldCheck className={cn('mt-0.5 h-5 w-5', loggerCheck.installed ? 'text-emerald-600' : 'text-amber-600')} />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <span>{loggerCheck.title}</span>
                  {isCheckingLogger ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                </div>
                <div className="text-sm text-muted-foreground">{loggerCheck.message}</div>
              </div>
              {loggerCheck.checked && (isRepairMode || !loggerCheck.installed) ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleInstall('system-logger', 'logger')}
                  disabled={!serverId || isInstalling}
                >
                  {isInstalling && installingTarget === 'system-logger' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isRepairMode ? 'Repair Install' : 'Install'}
                </Button>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-between">
            {loggerCheck.checked ? (
              <Button type="button" variant="outline" onClick={() => runCurrentStep('logger')} disabled={!serverId || isChecking || isInstalling}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reload
              </Button>
            ) : <div />}
            <Button type="button" disabled={!serverId || isChecking || isInstalling || !loggerCheck.installed}>
              Continue
            </Button>
          </CardFooter>
        </StepShell>
      ) : null}
    </div>
  );
}
