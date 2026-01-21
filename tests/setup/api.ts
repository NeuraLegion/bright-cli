import axios, { AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay } from 'axios-retry';
import { setTimeout } from 'node:timers/promises';

export interface ApiOptions {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  spoofIP?: boolean;
}

export interface WaitOptions {
  maxAttempts?: number;
  timeout?: number;
}

export interface WaitForRepeaterStatusOptions extends WaitOptions {
  desiredStatus: 'connected' | 'disconnected';
}

export interface CreateScanProps {
  name: string;
  crawlerUrls?: string[];
  entryPointIds?: string[];
  tests?: string[];
  repeaters?: string[];
  slowEpTimeout?: number;
  targetTimeout?: number;
  poolSize?: number;
  projectId?: string;
}

export class Api {
  private readonly client: AxiosInstance;

  constructor(options: ApiOptions) {
    this.client = axios.create({
      baseURL: options.baseUrl,
      responseType: 'json',
      timeout: options.timeout,
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

        if (options.spoofIP) {
          const ip = this.getRandomIP();

          request.headers['x-forwarded-for'] = ip;
          request.headers['x-real-ip'] = ip;
          request.headers['forwarded'] = `for=${ip}`;
        }

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

  public async getScanEntryPoint(scanId: string, entryPointId: string) {
    const { data: listData } = await this.client.get<{
      items: { id: string; projectEntryPointId?: string }[];
    }>(
      `/api/v2/scans/${scanId}/entry-points?targetEntryPointId[]=${entryPointId}`
    );

    const item = listData.items[0];

    if (!item) {
      throw new Error(
        `Scan entry point not found for project entry point ${entryPointId}`
      );
    }

    const { data } = await this.client.get<{
      id: string;
      request?: {
        headers?: Record<string, string>;
      };
    }>(`/api/v1/scans/${scanId}/entry-points/${item.id}`);

    return data;
  }

  public async createRepeater(
    name: string,
    projectId?: string
  ): Promise<string> {
    try {
      const { data } = await this.client.post<{ id: string }>(
        '/api/v1/repeaters',
        {
          name,
          ...(projectId ? { projectIds: [projectId] } : {})
        }
      );

      return data.id;
    } catch (error) {
      const is409 = axios.isAxiosError(error) && error.response?.status === 409;
      if (!is409) {
        throw error;
      }

      // Repeater with this name already exists - find and delete it, then retry
      const existingRepeater = await this.findRepeaterByName(name);
      if (!existingRepeater) {
        throw error;
      }

      await this.deleteRepeater(existingRepeater.id);

      // Retry creation
      const { data } = await this.client.post<{ id: string }>(
        '/api/v1/repeaters',
        {
          name,
          ...(projectId ? { projectIds: [projectId] } : {})
        }
      );

      return data.id;
    }
  }

  public async findRepeaterByName(
    name: string
  ): Promise<{ id: string; name: string } | undefined> {
    const { data } = await this.client.get<{ id: string; name: string }[]>(
      '/api/v1/repeaters'
    );

    return data.find((r) => r.name === name);
  }

  public async deleteRepeater(id: string) {
    await this.client.delete(`/api/v1/repeaters/${id}`);
  }

  public async updateRepeater(
    id: string,
    data: {
      name?: string;
      scripts?: { scriptId: string; host?: string }[];
    }
  ) {
    await this.client.put(`/api/v1/repeaters/${id}`, {
      ...data,
      active: true
    });
  }

  public async createScript(
    name: string,
    code: string,
    projectId?: string
  ): Promise<string> {
    const { data } = await this.client.post<{ id: string }>('/api/v1/scripts', {
      name,
      code,
      ...(projectId ? { projectIds: [projectId] } : {})
    });

    return data.id;
  }

  public async deleteScript(id: string) {
    await this.client.delete(`/api/v1/scripts/${id}`);
  }

  public async getRepeaterStatus(repeaterId: string) {
    const { data } = await this.client.get<{
      id: string;
      name: string;
      status: string;
      localScriptsUsed?: boolean;
    }>(`/api/v1/repeaters/${repeaterId}`);

    return data;
  }

  public async createScan(props: CreateScanProps): Promise<string> {
    const { data } = await this.client.post<{ id: string }>(
      '/api/v1/scans',
      props
    );

    return data.id;
  }

  public async waitForRepeater(
    repeaterId: string,
    options?: WaitForRepeaterStatusOptions
  ) {
    const status = options?.desiredStatus ?? 'connected';
    const maxAttempts = options?.maxAttempts ?? 60;
    const timeout = options?.timeout ?? 10_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data } = await this.client.get<{ status: string }>(
        `/api/v1/repeaters/${repeaterId}`
      );

      if (data.status === status) {
        return;
      }

      if (attempt === maxAttempts) {
        throw new Error(
          `Repeater ${repeaterId} is not ${status} after ${maxAttempts} checks`
        );
      } else {
        await setTimeout(timeout);
      }
    }
  }

  public async waitForScanToFinish(scanId: string, options?: WaitOptions) {
    const maxAttempts = options?.maxAttempts ?? 120;
    const timeout = options?.timeout ?? 30_000;

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

  public async getScanStatus(scanId: string) {
    const { data } = await this.client.get<{
      status: string;
      targets: string[];
      requests: number;
      entryPoints: number;
    }>(`/api/v1/scans/${scanId}`);

    return data;
  }

  public async deleteScan(scanId: string) {
    await this.client.delete(`/api/v1/scans/${scanId}`);
  }

  public async stopScan(scanId: string) {
    await this.client.get(`/api/v1/scans/${scanId}/stop`);
  }

  public async createProjectEntryPoint(
    projectId: string,
    request: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: string;
    },
    repeaterId?: string
  ): Promise<string> {
    try {
      const response = await this.client.post(
        `/api/v2/projects/${projectId}/entry-points`,
        {
          request,
          ...(repeaterId ? { repeaterId } : {})
        }
      );

      return response.data?.id;
    } catch (error) {
      const is409 = axios.isAxiosError(error) && error.response?.status === 409;
      if (!is409) {
        throw error;
      }

      // Entry point already exists, get ID from Location header
      const location = error.response.headers['location'];
      if (!location) {
        throw new Error('409 response but no Location header found');
      }

      const match = location.match(/entry-points\/([^/]+)$/);
      if (!match) {
        throw new Error(
          '409 response but Location header has unexpected format'
        );
      }

      return match[1];
    }
  }

  public async deleteProjectEntryPoint(
    projectId: string,
    entryPointId: string
  ): Promise<void> {
    await this.client.delete(
      `/api/v2/projects/${projectId}/entry-points/${entryPointId}`
    );
  }

  private getRandomIP() {
    const octet1 = Math.floor(Math.random() * 256);
    const octet2 = Math.floor(Math.random() * 256);
    const octet3 = Math.floor(Math.random() * 256);
    const octet4 = Math.floor(Math.random() * 256);

    return `${octet1}.${octet2}.${octet3}.${octet4}`;
  }
}
