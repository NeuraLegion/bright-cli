import {
  WireMock as WireMockCaptain,
  IWireMockRequest,
  IWireMockResponse
} from 'wiremock-captain';
import { setTimeout } from 'node:timers/promises';

export { IWireMockRequest, IWireMockResponse };

export interface RequestMatcher {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface WaitOptions {
  timeout?: number;
  interval?: number;
}

export class WireMock extends WireMockCaptain {
  constructor(baseUrl = 'http://localhost:8080') {
    super(baseUrl);
  }

  public async expectRequest(
    matcher: RequestMatcher,
    options: WaitOptions = {}
  ): Promise<WireMockLoggedRequest> {
    const { timeout = 10000, interval = 200 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const requests = await this.findMatchingRequests(matcher);

      if (requests.length > 0) {
        return requests[0];
      }

      await setTimeout(interval);
    }

    const allRequests = await this.getAllRequests();
    throw new Error(
      `No request matching ${JSON.stringify(
        matcher
      )} received within ${timeout}ms.\n` +
        `Received ${allRequests.length} request(s): ${JSON.stringify(
          allRequests,
          null,
          2
        )}`
    );
  }

  public async waitForReady(options: WaitOptions = {}): Promise<void> {
    const { timeout = 3000, interval = 100 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.#checkHealth()) {
        return;
      }

      await setTimeout(interval);
    }

    throw new Error(`WireMock not ready within ${timeout}ms`);
  }

  public async findMatchingRequests(
    matcher: RequestMatcher
  ): Promise<WireMockLoggedRequest[]> {
    let requests: WireMockLoggedRequest[];

    if (matcher.method && matcher.endpoint) {
      requests = (await this.getRequestsForAPI(
        matcher.method,
        matcher.endpoint
      )) as WireMockLoggedRequest[];
    } else {
      requests = (await this.getAllRequests()) as WireMockLoggedRequest[];
    }

    if (!matcher.headers) {
      return requests;
    }

    return requests.filter((req) => {
      const headers = matcher.headers;

      return headers
        ? this.#headersMatch(req.request?.headers ?? {}, headers)
        : true;
    });
  }

  #headersMatch(
    actual: Record<string, string>,
    expected: Record<string, string>
  ): boolean {
    return Object.entries(expected).every(([name, value]: [string, string]) => {
      const key = Object.keys(actual).find(
        (k) => k.toLowerCase() === name.toLowerCase()
      );

      return key && actual[key] === value;
    });
  }

  async #checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(this.makeUrl('/__admin/health'));

      return response.ok;
    } catch {
      return false;
    }
  }
}

export interface WireMockLoggedRequest {
  request: {
    method: string;
    absoluteUrl: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  responseDefinition?: {
    status: number;
  };
}

const WIREMOCK_URL = process.env.E2E_WIREMOCK_URL ?? 'http://localhost:8080';

export const wiremock = new WireMock(WIREMOCK_URL);
