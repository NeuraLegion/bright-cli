import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Cert, Request } from './Request';
import { Protocol } from './Protocol';
import { Helpers, logger, ProxyFactory } from '../Utils';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { RequestExecutorConstants } from './RequestExecutorConstants';
import { inject, injectable } from 'tsyringe';
import WebSocket from 'ws';
import { once } from 'node:events';
import { promisify } from 'node:util';
import http, { IncomingMessage } from 'node:http';
import https from 'node:https';

interface WSMessage {
  body: string;
  code?: number;
}

@injectable()
export class WsRequestExecutor implements RequestExecutor {
  public static readonly FORBIDDEN_HEADERS: ReadonlySet<string> = new Set([
    'sec-websocket-version',
    'sec-websocket-key'
  ]);

  private readonly httpProxyAgent?: http.Agent;
  private readonly httpsProxyAgent?: https.Agent;

  constructor(
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RequestExecutorOptions)
    private readonly options: RequestExecutorOptions,
    @inject(CertificatesCache)
    private readonly certificatesCache: CertificatesCache,
    @inject(CertificatesResolver)
    private readonly certificatesResolver: CertificatesResolver
  ) {
    if (this.options.proxyUrl) {
      ({ httpsAgent: this.httpsProxyAgent, httpAgent: this.httpProxyAgent } =
        this.proxyFactory.createProxy({ proxyUrl: this.options.proxyUrl }));
    }
  }

  get protocol(): Protocol {
    return Protocol.WS;
  }

  public async execute(options: Request): Promise<Response> {
    try {
      const targetCerts: Cert[] | undefined = this.options.certs
        ? this.certificatesResolver.resolve(options, this.options.certs)
        : undefined;

      if (targetCerts === undefined || targetCerts.length === 0) {
        // We may have https and http targets connected with same repeater,
        // or certificates may not be necessary.
        // If certificates not found try request anyway.
        logger.debug('Executing WS request with following params: %j', options);

        return await this.executeRequest(options);
      }

      return await this.tryRequestWithCertificates(options, targetCerts);
    } catch (err) {
      const message = err.info ?? err.message;
      const errorCode = err.code ?? err.syscall;

      logger.error('Error executing request: %s', options.url);
      logger.error('Cause: %s', message);

      return new Response({
        message,
        errorCode,
        protocol: this.protocol
      });
    }
  }

  private setTimeout(client: WebSocket): NodeJS.Timeout {
    const timeout = setTimeout(
      () =>
        client.emit(
          'error',
          Object.assign(new Error('Waiting frame has timed out'), {
            code: 'ETIMEDOUT'
          })
        ),
      this.options.timeout
    );

    timeout.unref();

    return timeout;
  }

  private async consume(
    client: WebSocket,
    matcher?: RegExp
  ): Promise<WSMessage> {
    const result = (await Promise.race([
      this.waitForResponse(client, matcher),
      once(client, 'close')
    ])) as [string | number, string | undefined];

    let msg: WSMessage | undefined;

    if (result.length) {
      const [data, reason]: [string | number, string | undefined] = result;
      const body = typeof data === 'string' ? data : reason;
      const code = typeof data === 'number' ? data : undefined;

      msg = {
        body,
        code
      };
    }

    return msg;
  }

  private waitForResponse(
    client: WebSocket,
    matcher: RegExp
  ): Promise<[string]> {
    return new Promise((resolve) => {
      client.on('message', (data: WebSocket.Data) => {
        const dataString = String(data);
        !matcher || matcher.test(dataString)
          ? resolve([dataString])
          : undefined;
      });
    });
  }

  private async connect(client: WebSocket): Promise<IncomingMessage> {
    const [, upgrading]: [unknown, [IncomingMessage]] = await Promise.all([
      once(client, 'open'),
      once(client, 'upgrade') as Promise<[IncomingMessage]>
    ]);

    const [res]: [IncomingMessage] = upgrading;

    return res;
  }

  private normalizeHeaders(
    headers: Record<string, string | string[]>
  ): Record<string, string | string[]> {
    return Object.entries(headers).reduce(
      (
        result: Record<string, string | string[]>,
        [key, value]: [string, string | string[]]
      ) => {
        const headerName = key.trim().toLowerCase();
        if (!WsRequestExecutor.FORBIDDEN_HEADERS.has(headerName)) {
          result[key] = value;
        }

        return result;
      },
      {}
    );
  }

  private async executeRequest(
    request: Request
  ): Promise<Response | undefined> {
    let timeout: NodeJS.Timeout;
    let client: WebSocket;

    try {
      client = new WebSocket(request.url, {
        agent: request.secureEndpoint
          ? this.httpsProxyAgent
          : this.httpProxyAgent,
        rejectUnauthorized: false,
        handshakeTimeout: this.options.timeout,
        headers: this.normalizeHeaders(request.headers),
        ca: request.ca,
        pfx: request.pfx,
        passphrase: request.passphrase,
        maxHeaderSize: RequestExecutorConstants.MAX_HEADERS_SIZE
      });

      const res: IncomingMessage = await this.connect(client);

      // @ts-expect-error TS infers a wrong type here
      await promisify(client.send.bind(client))(request.body);

      timeout = this.setTimeout(client);

      const msg = await this.consume(client, request.correlationIdRegex);

      return new Response({
        protocol: this.protocol,
        statusCode: msg.code ?? res.statusCode,
        headers: res.headers,
        body: msg.body
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }

      if (client?.readyState === WebSocket.OPEN) {
        client.close(1000);
      }
    }
  }

  private tryRequestWithCertificates(
    request: Request,
    certs: Cert[]
  ): Promise<Response> {
    const requestsWithCerts: Promise<Response>[] = certs.map(
      async (cert: Cert) => {
        logger.debug(
          'Executing HTTP request with following params: %j',
          request
        );
        try {
          await request.loadCert(cert);

          const response = await this.executeRequest(request);
          this.certificatesCache.add(request, cert);

          return response;
        } catch (error) {
          const msg = Helpers.isTlsCertError(error)
            ? `Failed to do successful request with certificate ${cert.path}. It will be excluded from list of known certificates.`
            : `Unexpected error occured during request: ${error}`;
          logger.warn(msg);
          throw error;
        }
      }
    );

    // @ts-expect-error TS forces to use es2021
    return Promise.any(requestsWithCerts);
  }
}
