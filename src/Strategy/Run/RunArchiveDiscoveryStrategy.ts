import { RunStrategy } from './RunStrategy';
import { basename } from 'path';
import { RequestPromiseAPI } from 'request-promise';
import {
  ResponseRef,
  RunStrategyConfig,
  ScanConfig
} from './RunStrategyExecutor';
import { Options as RequestOptions } from 'request';

export type ArchiveRef = { ids?: string[] } & { id?: string };

export abstract class RunArchiveDiscoveryStrategy extends RunStrategy {
  public async run(
    api: RequestPromiseAPI,
    config: RunStrategyConfig
  ): Promise<ScanConfig> {
    const { filePath, fileDiscard, ...scanConfig } = config;

    await this.validateFile(filePath);
    console.log(`${basename(filePath as string)} was verified and parsed.`);

    const ref: ResponseRef = await api.post(
      this.getUploadArchiveOptions(filePath, fileDiscard, scanConfig.headers)
    );
    console.log(`${basename(filePath as string)} was uploaded.`);

    const fileId: string = Array.isArray(ref.ids) ? ref.ids[0] : ref.id;

    return { ...scanConfig, fileId, discoveryTypes: this.discovery };
  }

  protected abstract getUploadArchiveOptions(
    filePath: string,
    discard?: boolean,
    headers?: { [key: string]: string }
  ): RequestOptions;

  protected abstract validateFile(filePath: string): Promise<void | never>;
}
