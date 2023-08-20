import request, { RequestPromiseAPI } from 'request-promise';

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
  private readonly client: RequestPromiseAPI;

  constructor(options: ApiOptions) {
    this.client = request.defaults({
      baseUrl: options.baseUrl,
      json: true,
      headers: { authorization: `api-key ${options.apiKey}` }
    });
  }

  public async createRepeater(name: string): Promise<string> {
    const { id }: { id: string } = await this.client.post({
      body: {
        name
      },
      uri: `/api/v1/repeaters`
    });

    return id;
  }

  public async deleteRepeater(id: string) {
    await this.client.delete({
      uri: `/api/v1/repeaters/${id}`
    });
  }

  public async createScan(props: CreateScanProps): Promise<string> {
    const { id }: { id: string } = await this.client.post({
      body: props,
      uri: `/api/v1/scans`
    });

    return id;
  }

  public async waitForRepeaterToConnect(
    repeaterId: string,
    options?: WaitOptions
  ) {
    const maxAttempts = options?.maxAttempts ?? 20;
    const timeout = options?.timeout ?? 10000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { status }: { status: string } = await this.client.get({
        uri: `/api/v1/repeaters/${repeaterId}`
      });

      if (status === 'connected') {
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
      const scan: {
        status: string;
        targets: string[];
        requests: number;
        entryPoints: number;
      } = await this.client.get({
        uri: `/api/v1/scans/${scanId}`
      });

      if (!['pending', 'running'].includes(scan.status)) {
        return scan;
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
