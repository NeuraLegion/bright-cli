import { Connectivity } from './Connectivity';
import { logger } from '../../Utils';
import { TestType } from '../TestType';
import { injectable } from 'tsyringe';
import { Socket } from 'net';
import { URL } from 'url';
import { once } from 'events';

@injectable()
export class TCPConnectivity implements Connectivity {
  public readonly type = TestType.TCP;
  private readonly CONNECTION_TIMEOUT = 10 * 1000; // 10 seconds

  public async test({ hostname, port }: URL): Promise<boolean> {
    const socket: Socket = new Socket();

    socket.setNoDelay(false);

    try {
      logger.debug(
        `TCP connectivity test. Opening socket to %s:%s`,
        hostname,
        +port
      );
      socket.setTimeout(this.CONNECTION_TIMEOUT, () =>
        socket.destroy(new Error(`Reached socket timeout.`))
      );
      process.nextTick(() => socket.connect(+port, hostname));
      await once(socket, 'connect');

      logger.debug('TCP connectivity test. Connection succesfull.');

      return true;
    } catch (err) {
      logger.debug(`TCP connectivity test. Connection failed: %s`, err.message);

      return false;
    } finally {
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
  }
}
