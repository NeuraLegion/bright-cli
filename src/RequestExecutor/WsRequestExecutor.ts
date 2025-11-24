import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Cert, Request } from './Request';
import { Protocol } from './Protocol';
import { Helpers, logger, ProxyFactory } from '../Utils';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
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
    private readonly certificatesCache: CertificatesCache
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
      logger.debug('Executing HTTP request with following params: %j', options);

      const targetCerts: Cert[] | undefined = this.options.certs
        ? this.certificatesForRequest(options)
        : undefined;

      if (targetCerts === undefined) {
        logger.debug('Executing WS request with following params: %j', options);

        return await this.tryRequest(options);
      }

      if (targetCerts.length === 0) {
        logger.warn(`Warning: certificate for ${options.url} not found.`);
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

  private certificatesForRequest(request: Request): Cert[] {
    const cachedCertificate = this.certificatesCache.get(request);
    if (cachedCertificate) {
      return [cachedCertificate];
    }

    const requestUrl = new URL(request.url);
    const port = Helpers.portFromURL(requestUrl);

    return this.options.certs.filter((cert: Cert) =>
      Helpers.matchHostnameAndPort(requestUrl.hostname, port, cert)
    );
  }

  private async tryRequest(request: Request): Promise<Response | undefined> {
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
        passphrase: request.passphrase
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

  private async tryRequestWithCertificate(
    request: Request,
    cert: Cert
  ): Promise<Response | undefined> {
    try {
      await request.setCert(cert);

      return await this.tryRequest(request);
    } catch (error) {
      return undefined;
    }
  }

  private async tryRequestWithCertificates(
    request: Request,
    certs: Cert[]
  ): Promise<Response> {
    for (const cert of certs) {
      const response = await this.tryRequestWithCertificate(request, cert);
      if (!response) {
        logger.warn(
          `Failed to do successful request with certificate ${cert.path}. It will be excluded from list of known certificates.`
        );
        continue;
      }
      logger.log(`Successfully executed request with certificate ${cert.path}`);

      this.certificatesCache.add(request, cert);

      return response;
    }

    throw Error(
      `Didn't find valid certificate to execute request for ${request.url}.`
    );
  }
}
