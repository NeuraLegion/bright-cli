import {
  config,
  createTestContext,
  setupBeforeAll,
  setupBeforeEach,
  teardownAfterEach,
  RepeaterTestContext
} from './setup';
import { wiremock } from '../../setup/wiremock';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Repeater: Scripts', () => {
  const ctx: RepeaterTestContext = createTestContext();
  const scriptDir = join(tmpdir(), 'bright-cli-e2e-scripts');
  const scriptPath = join(scriptDir, 'script.js');
  const customHeaderName = 'X-Custom-Header';
  const customHeaderValue = 'test-value';
  const scriptContent = `
  const handle = (request) => {
    request.headers = request.headers || {};
    request.headers['${customHeaderName}'] = '${customHeaderValue}';

    return request;
  };
  exports.handle = handle;
  `;

  beforeAll(async () => {
    setupBeforeAll(ctx);
    await mkdir(scriptDir, { recursive: true });
  });

  beforeEach(async () => {
    await setupBeforeEach(ctx);
    await wiremock.clearAllRequests();
  }, 10000);

  afterEach(async () => {
    try {
      await unlink(scriptPath);
    } catch {
      // ignore
    }
    await wiremock.clearAllMappings();
    await teardownAfterEach(ctx);
  }, 10000);

  describe('Local scripts', () => {
    it('should fail when script file does not exist', async () => {
      const scriptsJson = JSON.stringify({
        '*': '/non/existent/script.js'
      });

      const output = await ctx.cli.exec('repeater', [
        '--token',
        config.apiKey,
        '--id',
        ctx.repeaterId,
        '--cluster',
        config.cluster,
        '--scripts',
        scriptsJson
      ]);

      expect(output).toContain('Error Loading Script');
    }, 60000);

    it(
      'should run scan with custom headers passed to repeater via script',
      async () => {
        await writeFile(scriptPath, scriptContent, 'utf8');

        await wiremock.register(
          {
            method: 'GET',
            endpoint: '/repeaters/scripts'
          },
          {
            status: 200,
            body: 'OK',
            headers: { 'Content-Type': 'text/plain' }
          }
        );

        const scriptsJson = JSON.stringify({
          '*': scriptPath
        });
        ctx.commandProcess = ctx.cli.spawn('repeater', [
          '--token',
          config.apiKey,
          '--id',
          ctx.repeaterId,
          '--cluster',
          config.cluster,
          '--scripts',
          scriptsJson
        ]);
        ctx.commandProcess.stdout.pipe(process.stdout);
        ctx.commandProcess.stderr.pipe(process.stderr);

        await ctx.api.waitForRepeater(ctx.repeaterId);

        const entryPointId = await ctx.api.createProjectEntryPoint(
          config.projectId,
          {
            method: 'GET',
            url: `${config.wiremockUrl}/repeaters/scripts`
          },
          ctx.repeaterId
        );

        const scanId = await ctx.api.createScan({
          name: ctx.name,
          repeaters: [ctx.repeaterId],
          tests: ['header_security'],
          entryPointIds: [entryPointId],
          projectId: config.projectId
        });
        await ctx.api.waitForScanToFinish(scanId);

        await wiremock.expectRequest({
          method: 'GET',
          endpoint: '/repeaters/scripts',
          headers: { [customHeaderName]: customHeaderValue }
        });
      },
      config.maxTestTimeout
    );
  });

  describe('Remote scripts', () => {
    let remoteScriptId: string;

    afterEach(async () => {
      if (remoteScriptId) {
        try {
          await ctx.api.deleteScript(remoteScriptId);
        } catch {
          // ignore
        }
        remoteScriptId = null;
      }
    });

    it(
      'should start repeater with a remote script',
      async () => {
        remoteScriptId = await ctx.api.createScript(
          `E2E-${ctx.name}`,
          scriptContent,
          config.projectId
        );

        await ctx.api.updateRepeater(ctx.repeaterId, {
          name: ctx.name,
          scripts: [{ scriptId: remoteScriptId, host: '*' }]
        });

        ctx.commandProcess = ctx.cli.spawn('repeater', [
          '--token',
          config.apiKey,
          '--id',
          ctx.repeaterId,
          '--cluster',
          config.cluster
        ]);
        ctx.commandProcess.stdout.pipe(process.stdout);
        ctx.commandProcess.stderr.pipe(process.stderr);

        await ctx.api.waitForRepeater(ctx.repeaterId);

        const status = await ctx.api.getRepeaterStatus(ctx.repeaterId);
        expect(status.status).toBe('connected');
        expect(status.localScriptsUsed).toBe(false);
      },
      config.maxTestTimeout
    );

    it(
      'should run scan with custom headers passed to repeater via remote script',
      async () => {
        remoteScriptId = await ctx.api.createScript(
          `E2E-${ctx.name}`,
          scriptContent,
          config.projectId
        );

        await ctx.api.updateRepeater(ctx.repeaterId, {
          name: ctx.name,
          scripts: [{ scriptId: remoteScriptId, host: '*' }]
        });

        await wiremock.register(
          {
            method: 'GET',
            endpoint: '/repeaters/scripts'
          },
          {
            status: 200,
            body: 'OK',
            headers: { 'Content-Type': 'text/plain' }
          }
        );

        ctx.commandProcess = ctx.cli.spawn('repeater', [
          '--token',
          config.apiKey,
          '--id',
          ctx.repeaterId,
          '--cluster',
          config.cluster
        ]);
        ctx.commandProcess.stdout.pipe(process.stdout);
        ctx.commandProcess.stderr.pipe(process.stderr);

        await ctx.api.waitForRepeater(ctx.repeaterId);

        const entryPointId = await ctx.api.createProjectEntryPoint(
          config.projectId,
          {
            method: 'GET',
            url: `${config.wiremockUrl}/repeaters/scripts`
          },
          ctx.repeaterId
        );

        const scanId = await ctx.api.createScan({
          name: ctx.name,
          repeaters: [ctx.repeaterId],
          tests: ['header_security'],
          entryPointIds: [entryPointId],
          projectId: config.projectId
        });
        await ctx.api.waitForScanToFinish(scanId);

        await wiremock.expectRequest({
          method: 'GET',
          endpoint: '/repeaters/scripts',
          headers: { [customHeaderName]: customHeaderValue }
        });
      },
      config.maxTestTimeout
    );
  });
});
