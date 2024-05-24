import axios, { AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay } from 'axios-retry';
import { setTimeout } from 'node:timers/promises';

export interface ApiOptions {
  baseUrl: string;
  apiKey: string;
}

export interface WaitOptions {
  maxAttempts?: number;
  timeout?: number;
}

export interface CreateScanProps {
  name: string;
  poolSize?: number;
  repeaters?: string[];
  slowEpTimeout?: number;
  crawlerUrls: string[];
}

function getRandomIP() {
  // Generate random values for each octet of the IP address
  const octet1 = Math.floor(Math.random() * 256);
  const octet2 = Math.floor(Math.random() * 256);
  const octet3 = Math.floor(Math.random() * 256);
  const octet4 = Math.floor(Math.random() * 256);

  // Return the IP address as a string
  return `${octet1}.${octet2}.${octet3}.${octet4}`;
}

export class Api {
  private readonly client: AxiosInstance;

  constructor(options: ApiOptions) {
    this.client = axios.create({
      baseURL: options.baseUrl,
      responseType: 'json',
      transitional: {
        clarifyTimeoutError: true
      },
      headers: {
        authorization: `api-key ${options.apiKey}`
      }
    });

    axiosRetry(this.client, {
      retries: 10,
      retryDelay: exponentialDelay
    });

    const isGithubRunnerDebugMode =
      process.env.ACTIONS_STEP_DEBUG === 'true' ||
      process.env.ACTIONS_RUNNER_DEBUG === 'true';

    if (isGithubRunnerDebugMode) {
      this.client.interceptors.request.use((request) => {
        // eslint-disable-next-line no-console
        console.log('Request:', {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.data
        });

        const ip = getRandomIP();

        request.headers['x-forwarded-for'] = ip;
        request.headers['x-real-ip'] = ip;
        request.headers['forwarded'] = `for=${ip}`;

        return request;
      });

      this.client.interceptors.response.use(
        (response) => {
          // eslint-disable-next-line no-console
          console.log('Response:', {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: response.data
          });

          return response;
        },
        (error) => {
          if (axios.isAxiosError(error)) {
            if (error.response) {
              // eslint-disable-next-line no-console
              console.log('Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                body: error.response.data
              });
            }
          } else {
            // eslint-disable-next-line no-console
            console.log('Response Error:', error);
          }

          return Promise.reject(error);
        }
      );
    }
  }

  public async getScanEntryPointsConnectivity(scanId: string) {
    const { data } = await this.client.get<{ ok: number }>(
      `/api/v2/scans/${scanId}/entry-points/connectivity`
    );

    return data;
  }

  public async createRepeater(name: string): Promise<string> {
    const { data } = await this.client.post<{ id: string }>(
      '/api/v1/repeaters',
      {
        name
      }
    );

    return data.id;
  }

  public async deleteRepeater(id: string) {
    await this.client.delete(`/api/v1/repeaters/${id}`);
  }

  public async createScan(props: CreateScanProps): Promise<string> {
    const { data } = await this.client.post<{ id: string }>(
      '/api/v1/scans',
      props
    );

    return data.id;
  }

  public async waitForRepeaterToConnect(
    repeaterId: string,
    options?: WaitOptions
  ) {
    const maxAttempts = options?.maxAttempts ?? 50;
    const timeout = options?.timeout ?? 10000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data } = await this.client.get<{ status: string }>(
        `/api/v1/repeaters/${repeaterId}`
      );

      if (data.status === 'connected') {
        return;
      }

      if (attempt === maxAttempts) {
        throw new Error(
          `Repeater ${repeaterId} is not connected after ${maxAttempts} checks`
        );
      } else {
        await setTimeout(timeout);
      }
    }
  }

  public async waitForScanToFinish(scanId: string, options?: WaitOptions) {
    const maxAttempts = options?.maxAttempts ?? 200;
    const timeout = options?.timeout ?? 60000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data } = await this.client.get<{
        status: string;
        targets: string[];
        requests: number;
        entryPoints: number;
      }>(`/api/v1/scans/${scanId}`);

      if (!['pending', 'running'].includes(data.status)) {
        return data;
      }

      if (attempt === maxAttempts) {
        throw new Error(
          `Scan ${scanId} couldn't finish after ${maxAttempts} checks`
        );
      } else {
        await setTimeout(timeout);
      }
    }
  }
}
