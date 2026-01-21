import {
  config,
  createTestContext as createBaseTestContext,
  setupBeforeAll,
  teardownAfterEach as baseTeardownAfterEach,
  killProcess,
  RepeaterTestContext as BaseRepeaterTestContext
} from '../e2e/repeater/setup';
import { ChildProcess, spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { URL } from 'node:url';

export { config, setupBeforeAll };

export interface RepeaterTestContext extends BaseRepeaterTestContext {
  targetProcess: ChildProcess;
}

export function createTestContext(): RepeaterTestContext {
  return {
    ...createBaseTestContext(),
    targetProcess: null
  };
}

async function waitForTarget(
  url: string,
  maxAttempts = 30,
  interval = 100
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fetch(url);

      return;
    } catch {
      await setTimeout(interval);
    }
  }
  throw new Error(`Target server at ${url} did not start in time`);
}

export async function setupBeforeEach(ctx: RepeaterTestContext): Promise<void> {
  const [targetCmd, ...targetArgs]: string[] = config.targetCmd.split(' ');
  ctx.targetProcess = spawn(targetCmd, targetArgs, {
    shell: true,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env
    }
  });

  ctx.targetProcess.stdout.pipe(process.stdout);
  ctx.targetProcess.stderr.pipe(process.stderr);

  // Use localhost for health check since the target runs in the same environment as the test
  // (host.docker.internal points to the host machine, not the container where target runs)
  const targetPort = new URL(config.targetUrl).port || '80';
  await waitForTarget(`http://localhost:${targetPort}`);

  ctx.repeaterId = await ctx.api.createRepeater(ctx.name, config.projectId);
}

export async function teardownAfterEach(
  ctx: RepeaterTestContext
): Promise<void> {
  await killProcess(ctx.targetProcess);
  ctx.targetProcess = null;

  await baseTeardownAfterEach(ctx);
}
