import 'reflect-metadata';
import { HttpRequestExecutor } from './HttpRequestExecutor';
import { VirtualScripts } from '../Scripts';
import { Protocol } from './Protocol';
import { Request } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { instance, mock } from 'ts-mockito';
import http from 'node:http';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';

// A short latency budget guard for the repeater's outbound request path.
//
// The repeater handles one inbound event per request, so it issues outbound
// requests serially. That is the pattern that regresses when the native libcurl
// binding stops draining completions promptly: the transfer itself finishes in
// microseconds, but the `end` event is only delivered once libcurl's multi timer
// fires. Concurrency masks it, because other in-flight transfers keep waking the
// event loop - only a serialized measurement exposes it.
//
// Asserting on the MEAN is deliberate. The observed failure mode is periodic
// rather than uniform: on an affected runtime roughly every third request stalls
// (measured 711, 201, 95, 702, 226, 149, ... ms) while the rest look merely
// sluggish, so the median stays low enough to slip past a threshold that the
// mean trips decisively. Against a loopback server a healthy path averages well
// under a millisecond, so the budget below leaves two orders of magnitude of
// headroom for a loaded CI runner while still catching a single stalled request.
const MEASURED_REQUESTS = 12;
const WARMUP_REQUESTS = 3;
const MAX_MEAN_LATENCY_MS = 50;

describe('HttpRequestExecutor', () => {
  const virtualScriptsMock = mock<VirtualScripts>();
  const certificatesCacheMock = mock<CertificatesCache>();
  const certificatesResolverMock = mock<CertificatesResolver>();

  let server!: http.Server;
  let baseUrl!: string;

  const buildSut = (options: RequestExecutorOptions = {}) =>
    new HttpRequestExecutor(
      instance(virtualScriptsMock),
      options,
      certificatesCacheMock,
      instance(certificatesResolverMock)
    );

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => res.end('ok'));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      )
  );

  describe('execute', () => {
    const measureOnce = async (sut: HttpRequestExecutor): Promise<number> => {
      const startedAt = process.hrtime.bigint();

      await sut.execute(
        new Request({ url: baseUrl, method: 'GET', protocol: Protocol.HTTP })
      );

      return Number(process.hrtime.bigint() - startedAt) / 1e6;
    };

    it('should deliver serialized requests without waiting on libcurl timers', async () => {
      const sut = buildSut({ timeout: 30000 });

      // the first requests pay for JIT and the initial native setup
      for (let i = 0; i < WARMUP_REQUESTS; i++) {
        await measureOnce(sut);
      }

      const latencies: number[] = [];
      for (let i = 0; i < MEASURED_REQUESTS; i++) {
        latencies.push(await measureOnce(sut));
      }

      const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      // Assert on an object rather than the bare number: on failure Jest prints
      // the whole thing, so the report shows how slow it got, on which runtime,
      // and the individual samples - enough to tell a real regression from a
      // noisy runner without rerunning anything.
      expect({
        node: process.version,
        meanMs: Math.round(mean),
        maxMs: Math.round(Math.max(...latencies)),
        budgetMs: MAX_MEAN_LATENCY_MS,
        samplesMs: latencies.map((value) => Math.round(value)),
        withinBudget: mean < MAX_MEAN_LATENCY_MS
      }).toMatchObject({ withinBudget: true });
    }, 60000);
  });
});
