'use server';

import * as Go from '@/services/core/go';
import * as PHP from '@/services/core/php';
import * as Laravel from '@/services/core/laravel';
import * as NextJs from '@/services/core/nextjs';
import * as NodeJs from '@/services/core/nodejs';
import * as Python from '@/services/core/python';

import { getApplication } from './crud';
import { getProcessDetails, getSupervisorProcesses } from './process-management';
import { getSelectedServerId, getSelectedServerName } from './session';
import { getApplicationServerMapData } from './server-map';

export async function getApplicationDetailPageData(params: Promise<{ id: string }>) {
  const { id } = await params;
  const [serverName, serverId] = await Promise.all([
    getSelectedServerName(),
    getSelectedServerId(),
  ]);

  if (id.startsWith('supervisor_')) {
    const processName = id.slice('supervisor_'.length);
    const [processDetails, supervisorProcesses] = await Promise.all([
      getProcessDetails('supervisor', processName),
      getSupervisorProcesses(),
    ]);
    const summary = Array.isArray(supervisorProcesses)
      ? supervisorProcesses.find((process: any) => process.name === processName)
      : null;

    return { supervisor: true as const, processName, processDetails, summary, serverName, serverId };
  }

  const application = await getApplication(id) as any;
  if (!application) return { notFound: true as const };
  const serverMapData = await getApplicationServerMapData(application.id, serverId);

  const appLanguage = application.language === 'next' ? 'Next.js' :
    application.language === 'node' ? 'Node.js' :
      application.language === 'python' ? 'Python' :
        application.language === 'php' ? 'Core PHP' :
          application.language === 'laravel' ? 'Laravel' :
        application.language === 'go' ? 'Go' : 'Custom';

  if (!application.commands) {
    application.commands = {};
  }

  const uniquePorts = application.networkAccess?.map(Number).filter((p: number) => !isNaN(p) && p > 0) || [];
  const context = {
    applicationId: application.id,
    appName: application.name,
    appLocation: application.location,
    preferredPorts: uniquePorts,
    entryFile: application.information?.entryFile,
    supervisorServiceName: application.information?.supervisorServiceName,
  };

  let commandsArray: any[] = [];

  if (application.language === 'next') {
    commandsArray = NextJs.getCommands(context);
  } else if (application.language === 'node') {
    commandsArray = NodeJs.getCommands(context);
  } else if (application.language === 'python') {
    commandsArray = Python.getCommands(context);
  } else if (application.language === 'php') {
    commandsArray = PHP.getCommands(context);
  } else if (application.language === 'laravel') {
    commandsArray = Laravel.getCommands(context);
  } else if (application.language === 'go') {
    commandsArray = Go.getCommands(context);
  }

  commandsArray.forEach((cmdDef: any) => {
    const name = cmdDef.title.toLowerCase();
    const parts = [];
    if (cmdDef.command.preCommand) parts.push(cmdDef.command.preCommand);
    parts.push(cmdDef.command.mainCommand);
    if (cmdDef.command.postCommand) parts.push(cmdDef.command.postCommand);

    application.commands[name] = parts.join('\n');
    cmdDef._mainCommand = cmdDef.command.mainCommand;
  });

  application.commandDefinitions = commandsArray;

  return { supervisor: false as const, application, appLanguage, serverName, serverId, ...serverMapData };
}

export async function getApplicationFilesPageData(params: Promise<{ id: string }>) {
  const { id } = await params;
  const application = await getApplication(id);
  return { id, application };
}
