import { Cli, Api } from '../../Setup';
import { URL } from 'node:url';
import { ChildProcess, spawn } from 'node:child_process';

export const config = {
  version: process.env.E2E_CLI_VERSION,
  cmd: process.env.E2E_CLI_CMD,
  cluster: process.env.E2E_CLUSTER,
  apiKey: process.env.E2E_CLUSTER_API_KEY,
  runId: process.env.E2E_RUN_ID,
  projectId: process.env.E2E_PROJECT_ID,
  targetUrl: process.env['E2E_REPEATER_TARGET_URL'],
  targetCmd: process.env['E2E_REPEATER_TARGET_CMD'],
  maxTestTimeout: parseInt(process.env.E2E_TEST_TIMEOUT, 10) * 1000
};

export interface RepeaterTestContext {
  name: string;
  api: Api;
  cli: Cli;
  targetHost: string;
  repeaterId: string;
  targetProcess: ChildProcess;
  commandProcess: ChildProcess;
}

export function createTestContext(): RepeaterTestContext {
  return {
    name: '',
    api: null,
    cli: null,
    targetHost: '',
    repeaterId: '',
    targetProcess: null,
    commandProcess: null
  };
}

export function setupBeforeAll(ctx: RepeaterTestContext): void {
  const [cliCmd, ...cliArgs]: string[] = config.cmd.split(' ');
  ctx.cli = new Cli(cliCmd, cliArgs);
  ctx.name = `E2E: Repeater Bright CLI ${config.version} (${config.runId})`;
  ctx.targetHost = new URL(config.targetUrl).host;
  ctx.api = new Api({
    baseUrl: `https://${config.cluster}`,
    apiKey: config.apiKey,
    timeout: 60_000,
    spoofIP: true
  });
}

export async function setupBeforeEach(ctx: RepeaterTestContext): Promise<void> {
  const [targetCmd, ...targetArgs]: string[] = config.targetCmd.split(' ');
  ctx.targetProcess = spawn(targetCmd, targetArgs, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env
    }
  });

  ctx.targetProcess.stdout.pipe(process.stdout);
  ctx.targetProcess.stderr.pipe(process.stderr);

  ctx.repeaterId = await ctx.api.createRepeater(ctx.name, config.projectId);
}

export async function teardownAfterEach(
  ctx: RepeaterTestContext
): Promise<void> {
  if (ctx.commandProcess) {
    ctx.commandProcess.stderr.destroy();
    ctx.commandProcess.stdout.destroy();
    ctx.commandProcess.kill('SIGTERM');
    ctx.commandProcess = null;
  }

  if (ctx.targetProcess) {
    ctx.targetProcess.stderr.destroy();
    ctx.targetProcess.stdout.destroy();
    ctx.targetProcess.kill('SIGTERM');
    ctx.targetProcess = null;
  }

  await ctx.api.deleteRepeater(ctx.repeaterId);

  ctx.repeaterId = null;
}
