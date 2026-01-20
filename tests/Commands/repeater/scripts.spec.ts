import {
  config,
  createTestContext,
  setupBeforeAll,
  setupBeforeEach,
  teardownAfterEach,
  RepeaterTestContext
} from './setup';
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
  }, 10000);

  afterEach(async () => {
    try {
      await unlink(scriptPath);
    } catch {
      // ignore
    }
    await teardownAfterEach(ctx);
  }, 10000);

  describe('Local scripts', () => {
    it('should start repeater with a custom script', async () => {
      // arrange
      await writeFile(scriptPath, scriptContent, 'utf8');

      const scriptsJson = JSON.stringify({ '*': scriptPath });

      // act
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

      // assert
      const status = await ctx.api.getRepeaterStatus(ctx.repeaterId);
      expect(status.status).toBe('connected');
      expect(status.localScriptsUsed).toBe(true);
    }, 30000);

    it('should fail when script file does not exist', async () => {
      // arrange
      const scriptsJson = JSON.stringify({
        '*': '/non/existent/script.js'
      });

      // act
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

      // assert
      expect(output).toContain('Error Loading Script');
    }, 30000);

    it(
      'should run scan with custom headers passed to repeater via script',
      async () => {
        // arrange
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

        // act
        const scanId = await ctx.api.createScan({
          name: ctx.name,
          repeaters: [ctx.repeaterId],
          tests: ['header_security'],
          crawlerUrls: [config.targetUrl],
          projectId: config.projectId
        });
        const scan = await ctx.api.waitForScanToFinish(scanId);
        const entryPoints = await ctx.api.getScanEntryPoints(scanId);

        // assert
        expect(scan.requests).toBeGreaterThan(0);
        expect(scan.status).toBe('done');
        expect(entryPoints.length).toBeGreaterThan(0);

        expect(
          entryPoints.every(
            (ep) =>
              ep.request?.headers?.[customHeaderName] === customHeaderValue
          )
        ).toBe(true);
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

    it('should start repeater with a remote script', async () => {
      // arrange
      remoteScriptId = await ctx.api.createScript(
        `E2E-${ctx.name}`,
        scriptContent
      );

      await ctx.api.updateRepeater(ctx.repeaterId, {
        scripts: [{ scriptId: remoteScriptId, host: '*' }]
      });

      // act
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

      // assert
      const status = await ctx.api.getRepeaterStatus(ctx.repeaterId);
      expect(status.status).toBe('connected');
      expect(status.localScriptsUsed).toBe(false);
    }, 30000);

    it(
      'should run scan with custom headers passed to repeater via remote script',
      async () => {
        // arrange
        remoteScriptId = await ctx.api.createScript(
          `E2E-${ctx.name}`,
          scriptContent
        );

        await ctx.api.updateRepeater(ctx.repeaterId, {
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

        // act
        const scanId = await ctx.api.createScan({
          name: ctx.name,
          repeaters: [ctx.repeaterId],
          tests: ['header_security'],
          crawlerUrls: [config.targetUrl],
          projectId: config.projectId
        });
        const scan = await ctx.api.waitForScanToFinish(scanId);
        const entryPoints = await ctx.api.getScanEntryPoints(scanId);

        // assert
        expect(scan.requests).toBeGreaterThan(0);
        expect(scan.status).toBe('done');
        expect(entryPoints.length).toBeGreaterThan(0);

        expect(
          entryPoints.every(
            (ep) =>
              ep.request?.headers?.[customHeaderName] === customHeaderValue
          )
        ).toBe(true);
      },
      config.maxTestTimeout
    );
  });
});
