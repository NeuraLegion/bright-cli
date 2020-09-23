import { Connectivity } from './Connectivity';
import logger from '../../Utils/Logger';
import { Socket } from 'net';

export class TCPConnectivity implements Connectivity {
  private readonly tcp_test_fqdn: string = 'amq.nexploit.app';
  private readonly tcpt_test_port: number = 5672;
  private readonly connection_timeout = 30 * 1000; // 30 seconds

  public async test(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      logger.debug(
        `TCP connectivity test - openning socket to ${this.tcp_test_fqdn}:${this.tcpt_test_port}`
      );
      const socket: Socket = new Socket();
      socket.setTimeout(this.connection_timeout, () => {
        logger.debug(
          `TCP connectivity test - reached socket timeout. Connection failed.`
        );
        socket.destroy();
        resolve(false);
      });
      socket.connect(this.tcpt_test_port, this.tcp_test_fqdn, () => {
        logger.debug(`TCP connectivity test - Connection succesfull.`);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', (err: Error) => {
        logger.debug(
          `TCP connectivity test - received socket error. Connection failed.`,
          err
        );
        socket.destroy();
        resolve(false);
      });
    });
  }
}
