import { bind, Handler } from '../Bus';
import { LatestVersionPublished } from './Events';
import { logger } from '../Utils';
import { injectable } from 'tsyringe';
import chalk from 'chalk';

@injectable()
@bind(LatestVersionPublished)
export class LatestVersionPublishedHandler
  implements Handler<LatestVersionPublished> {
  public async handle({
    version,
    needToBeUpdated
  }: LatestVersionPublished): Promise<void> {
    logger.warn(
      '%s: A new Repeater version (%s) is available, for update instruction visit https://kb.neuralegion.com/#/guide/np-cli/installation',
      chalk.yellow('(!) IMPORTANT'),
      version
    );

    if (needToBeUpdated) {
      logger.error(
        '%s: The current running version is no longer supported',
        chalk.red('(!) CRITICAL')
      );
      process.exit(1);
    }
  }
}
