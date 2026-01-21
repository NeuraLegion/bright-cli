import { Api } from '../../setup/api';
import { Cli } from '../../setup/cli';
import { URL } from 'node:url';
import { ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';

export const config = {
  version: process.env.E2E_CLI_VERSION,
  cmd: process.env.E2E_CLI_CMD,
  cluster: process.env.E2E_CLUSTER,
  apiKey: process.env.E2E_CLUSTER_API_KEY,
  runId: process.env.E2E_RUN_ID,
  projectId: process.env.E2E_PROJECT_ID,
  targetUrl: process.env['E2E_REPEATER_TARGET_URL'],
  targetCmd: process.env['E2E_REPEATER_TARGET_CMD'],
  wiremockUrl: process.env['E2E_WIREMOCK_URL'] ?? 'http://localhost:8080',
  maxTestTimeout: parseInt(process.env.E2E_TEST_TIMEOUT, 10) * 1000
};

export interface RepeaterTestContext {
  name: string;
  api: Api;
  cli: Cli;
  targetHost: string;
  repeaterId: string;
  commandProcess: ChildProcess;
}

export function createTestContext(): RepeaterTestContext {
  return {
    name: '',
    api: null,
    cli: null,
    targetHost: '',
    repeaterId: '',
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
  ctx.repeaterId = await ctx.api.createRepeater(ctx.name, config.projectId);
}

export async function teardownAfterEach(
  ctx: RepeaterTestContext
): Promise<void> {
  await killProcess(ctx.commandProcess);

  ctx.commandProcess = null;

  await ctx.api.deleteRepeater(ctx.repeaterId);

  ctx.repeaterId = null;
}

export async function killProcess(proc: ChildProcess): Promise<void> {
  if (!proc || proc.killed) {
    return;
  }

  proc.stdout?.unpipe();
  proc.stderr?.unpipe();
  proc.stdout?.destroy();
  proc.stderr?.destroy();

  // Kill the entire process group (negative pid) to ensure child processes are also killed
  try {
    process.kill(-proc.pid, 'SIGKILL');
  } catch {
    // Process may have already exited
    proc.kill('SIGKILL');
  }

  // Wait for exit or timeout after 5 seconds
  await Promise.race([once(proc, 'exit'), setTimeout(5000)]);
}
