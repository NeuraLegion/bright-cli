import axios, { Axios } from 'axios';

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
  repeaters?: string[];
  crawlerUrls: string[];
  smart: boolean;
}

export class Api {
  private readonly client: Axios;

  constructor(options: ApiOptions) {
    this.client = axios.create({
      baseURL: options.baseUrl,
      responseType: 'json',
      transitional: {
        clarifyTimeoutError: true
      },
      headers: { authorization: `api-key ${options.apiKey}` }
    });
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
    const maxAttempts = options?.maxAttempts ?? 20;
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
        await this.sleep(timeout);
      }
    }
  }

  public async waitForScanToFinish(scanId: string, options?: WaitOptions) {
    const maxAttempts = options?.maxAttempts ?? 100;
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
        await this.sleep(timeout);
      }
    }
  }

  private async sleep(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }
}
