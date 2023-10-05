import { logger } from '../Utils';
import request, { RequestPromiseAPI } from 'request-promise';
import { promises, constants } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const { readFile, writeFile, access } = promises;
const { F_OK } = constants;

export interface SystemConfig {
  sentryDsn?: string;
}

interface SystemConfigFile {
  data: SystemConfig;
  updatedAt: Date;
}

export class SystemConfigReader {
  private readonly rotationInterval = 3600000;
  private readonly path = join(homedir(), '.brightclirc');
  private readonly client: RequestPromiseAPI;

  constructor(baseUrl: string) {
    this.client = request.defaults({
      baseUrl,
      timeout: 1500,
      json: true
    });
  }

  public async read(): Promise<SystemConfig> {
    await this.rotateIfNecessary();
    const configFile = await this.getConfigFile();

    return {
      sentryDsn: process.env['SENTRY_DSN'],
      ...configFile.data
    };
  }

  private async rotateIfNecessary() {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    logger.debug('Trying to rotate system config');

    const configFile = await this.getConfigFile();
    const lifeTime = Date.now() - configFile.updatedAt.getTime();

    if (lifeTime < this.rotationInterval) {
      logger.debug(
        'Rotation is not needed, system config is fresh: %s ms',
        lifeTime
      );

      return;
    }

    logger.debug(
      "Rotating system config because it's too old: %s ms",
      lifeTime
    );

    const newConfig = await this.fetchNewConfig();

    if (newConfig) {
      await this.updateConfigFile({
        data: newConfig,
        updatedAt: new Date()
      });
    } else {
      logger.debug('Rotation failed');

      await this.updateConfigFile({
        ...configFile,
        updatedAt: new Date()
      });
    }
  }

  private defaultConfigFile(): SystemConfigFile {
    return {
      data: {},
      updatedAt: new Date()
    };
  }

  private async getConfigFile() {
    const defaultConfigFile = this.defaultConfigFile();

    try {
      logger.debug('Loading system config file');

      const configFileExists = await this.configFileExists();

      if (!configFileExists) {
        logger.debug(
          "System config file doesn't exist. Creating a new one with default values"
        );

        await this.updateConfigFile(defaultConfigFile);
      }

      const file = await readFile(this.path);
      const fileConfig = JSON.parse(file.toString()) as SystemConfigFile;

      return {
        ...fileConfig,
        updatedAt: new Date(fileConfig.updatedAt)
      };
    } catch (e) {
      logger.debug('Error during loading system config file', e);
      logger.debug('Using default system config file');

      return defaultConfigFile;
    }
  }

  private async updateConfigFile(configFile: SystemConfigFile) {
    logger.debug('Updating system config file');

    try {
      await writeFile(this.path, JSON.stringify(configFile));
    } catch (e) {
      logger.debug('Error during updating system config file', e);
    }
  }

  private async configFileExists(): Promise<boolean> {
    try {
      await access(this.path, F_OK);

      return true;
    } catch (e) {
      return false;
    }
  }

  private async fetchNewConfig(): Promise<SystemConfig | undefined> {
    logger.debug('Fetching new system config');

    try {
      return await this.client.get({
        uri: '/api/v1/cli/config'
      });
    } catch (e) {
      logger.debug('Error during fetching new system config: ', e);
    }
  }
}
