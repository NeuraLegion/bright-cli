import { bind, Handler } from '../Bus';
import { LatestVersionPublished } from './Events';
import { logger } from '../Utils';
import { injectable } from 'tsyringe';
import chalk from 'chalk';
import { eq, gt, major } from 'semver';

@injectable()
@bind(LatestVersionPublished)
export class LatestVersionPublishedHandler
  implements Handler<LatestVersionPublished> {
  public async handle({
    version,
    lastUsedVersion,
    repeaterId
  }: LatestVersionPublished): Promise<void> {
    if (gt(version, lastUsedVersion)) {
      logger.warn(
        '%s: A new Repeater version (%s) is available, for update instruction visit https://kb.neuralegion.com/#/guide/np-cli/installation',
        chalk.yellow('(!) IMPORTANT'),
        version
      );
    }

    if (major(version) > major(lastUsedVersion)) {
      logger.error(
        '%s: The current running version is no longer supported',
        chalk.red('(!) CRITICAL')
      );
      process.exit(1);
    }

    if (!eq(lastUsedVersion, version)) {
      logger.error(
        'Access Refused: There is an already running Repeater with ID %s, but with a different version',
        repeaterId
      );

      process.exit(1);
    }
  }
}
