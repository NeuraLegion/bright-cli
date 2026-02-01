import { logger } from '../Utils';
import axios, { Axios } from 'axios';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { setTimeout } from 'node:timers/promises';
import http from 'node:http';

export interface SystemConfig {
  sentryDsn?: string;
}

interface SystemConfigFile {
  data: SystemConfig;
  updatedAt: Date;
}

export class SystemConfigManager {
  private readonly rotationInterval = 3600000;
  private readonly path = join(homedir(), '.brightclirc');
  private readonly client: Axios;
  private backgroundRotationEnabled = false;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 1500,
      responseType: 'json',
      transitional: {
        clarifyTimeoutError: true
      }
    });

    logger.debug('boba: maxHeaderSize', http.maxHeaderSize);
  }

  public async read(): Promise<SystemConfig> {
    await this.rotateIfNecessary();
    const configFile = await this.getConfigFile();

    return {
      sentryDsn: process.env['SENTRY_DSN'],
      ...configFile.data
    };
  }

  public enableBackgroundRotation(onRotation: (config: SystemConfig) => void) {
    this.backgroundRotationEnabled = true;

    this.runBackgroundRotation(onRotation).catch((e) => {
      logger.debug('An error occurred during background rotation', e);
    });
  }

  public disableBackgroundRotation() {
    this.backgroundRotationEnabled = false;
  }

  private async runBackgroundRotation(
    onRotation: (config: SystemConfig) => void
  ) {
    while (this.backgroundRotationEnabled) {
      logger.debug('Performing background rotation of system config file');

      const isRotated = await this.rotateIfNecessary();

      if (isRotated) {
        const configFile = await this.getConfigFile();

        onRotation(configFile.data);

        logger.debug(
          'Background rotation is done, sleeping for %s ms',
          this.rotationInterval
        );
      }

      await setTimeout(this.rotationInterval, undefined, { ref: false });
    }
  }

  private needsRotation(configFile: SystemConfigFile) {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    const lifeTime = Date.now() - configFile.updatedAt.getTime();

    return lifeTime >= this.rotationInterval;
  }

  private async rotateIfNecessary() {
    logger.debug('Trying to rotate system config');

    const configFile = await this.getConfigFile();

    if (!this.needsRotation(configFile)) {
      logger.debug(
        'Rotation is not needed, last updated on: %s ms',
        configFile.updatedAt
      );

      return false;
    }

    logger.debug(
      'Rotating system config last updated on: %s ms',
      configFile.updatedAt
    );

    const newConfig = await this.fetchNewConfig();

    if (newConfig) {
      await this.updateConfigFile({
        data: newConfig,
        updatedAt: new Date()
      });

      return true;
    } else {
      logger.debug('Rotation failed');

      await this.updateConfigFile({
        ...configFile,
        updatedAt: new Date()
      });

      return false;
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

      const file = await readFile(this.path);
      const fileConfig = JSON.parse(file.toString()) as SystemConfigFile;

      return {
        ...fileConfig,
        updatedAt: new Date(fileConfig.updatedAt)
      };
    } catch (e) {
      if (e.code === 'ENOENT') {
        logger.debug("System config file doesn't exist at %s", this.path);

        return defaultConfigFile;
      }

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

  private async fetchNewConfig(): Promise<SystemConfig | undefined> {
    logger.debug('Fetching new system config');

    try {
      const { data } = await this.client.get<SystemConfig | undefined>(
        '/api/v1/cli/config'
      );

      return data;
    } catch (e) {
      logger.debug('Error during fetching new system config: ', e);
    }
  }
}
