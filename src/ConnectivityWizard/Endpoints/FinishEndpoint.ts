import { Endpoint } from './Endpoint';
import Koa from 'koa';
import logger from 'src/Utils/Logger';

export class FinishEndpoint implements Endpoint {
  public handle(ctx: Koa.Context): Promise<void> {
    logger.debug('Finish wizard, terminating the process');
    logger.log(
      'A Repeater has been set up successfully on this machine, please keep this console window open to keep the Repeater running.'
    );
    ctx.status = 200;
    setTimeout(() => {
      process.exit(0);
    }, 1000);

    return;
  }
}
