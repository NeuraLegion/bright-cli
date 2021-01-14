import { Connectivity } from './Connectivity';
import { logger } from '../../Utils';
import { Socket } from 'net';
import { URL } from 'url';
import { once } from 'events';

export class TCPConnectivity implements Connectivity {
  private readonly CONNECTION_TIMEOUT = 30 * 1000; // 30 seconds
  private readonly fqdn: string;
  private readonly port: number;

  constructor({ hostname, port }: URL) {
    if (!hostname || !port) {
      throw new Error(
        'Missing proper endpoint and port for tcp connectivity test'
      );
    }
    this.fqdn = hostname;
    this.port = +port;
  }

  public async test(): Promise<boolean> {
    const socket: Socket = new Socket();

    socket.setNoDelay(false);

    try {
      logger.debug(
        `TCP connectivity test. Opening socket to %s:%s`,
        this.fqdn,
        this.port
      );
      socket.setTimeout(this.CONNECTION_TIMEOUT, () =>
        socket.destroy(new Error(`Reached socket timeout.`))
      );
      socket.connect(this.port, this.fqdn);
      await once(socket, 'connect');

      logger.debug('TCP connectivity test. Connection succesfull.');

      return true;
    } catch (err) {
      logger.debug(`TCP connectivity test. Connection failed: %s`, err.message);

      return false;
    } finally {
      socket.destroy();
    }
  }
}
