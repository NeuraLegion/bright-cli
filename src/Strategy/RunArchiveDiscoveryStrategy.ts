import { RunStrategy, ScanConfig } from './RunStrategy';
import { basename } from 'path';

export type ArchiveRef = { ids?: string[] } & { id?: string };

export abstract class RunArchiveDiscoveryStrategy extends RunStrategy {
  public async run(config: ScanConfig): Promise<void> {
    await this.validateFile(config.filePath);
    console.log(
      `${basename(config.filePath as string)} was verified and parsed by ${
        process.argv0
      }.`
    );

    const ref: ArchiveRef = await this.uploadArchive(
      config.filePath,
      config.fileDiscard,
      config.headers
    );
    console.log(
      `${basename(config.filePath as string)} was uploaded by ${process.argv0}.`
    );

    const fileId: string = Array.isArray(ref.ids) ? ref.ids[0] : ref.id;

    await super.configureScan(config, fileId);
  }

  protected abstract uploadArchive(
    filePath: string,
    discard?: boolean,
    headers?: { [key: string]: string }
  ): Promise<ArchiveRef>;

  protected abstract validateFile(filePath: string): Promise<void | never>;
}
