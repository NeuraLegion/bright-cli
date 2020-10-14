import { ConnectivityTest } from '../models';
import { Pipe, PipeTransform } from '@angular/core';

export type ConnectivityStage = 'init' | 'success' | 'error';

@Pipe({
  name: 'connectivity',
  pure: true
})
export class ConnectivityPipe implements PipeTransform {
  public transform(
    test: ConnectivityTest,
    stage: ConnectivityStage = 'init'
  ): string | null {
    switch (stage) {
      case 'init':
        return this.formatInitStage(test);
      case 'error':
        return this.formatErrorStage(test);
      case 'success':
        return 'Success';
    }
  }

  private formatInitStage(test: ConnectivityTest): string | null {
    switch (test) {
      case ConnectivityTest.TCP:
        return 'Validating that the connection to amq.nexploit.app at port 5672 is open';
      case ConnectivityTest.HTTP:
        return 'Validating that the connection to nexploit.app at port 443 is open';
      case ConnectivityTest.AUTH:
        return 'Verifying provided Token and Repeater ID';
    }
  }

  private formatErrorStage(test: ConnectivityTest): string | null {
    switch (test) {
      case ConnectivityTest.TCP:
        return `Connection to amq.nexploit.app:5672 is blocked, please verify that the machine on which the
          Repeater is installed can reach the remote server. Possible reasons for communication failure:
          ● Outbound communication to the host is blocked by a Firewall or network settings.`;
      case ConnectivityTest.HTTP:
        return `Connection to nexploit.app:443 is blocked, please verify that the machine on which the
          Repeater is installed can reach the remote server. Possible reasons for communication failure:
          ● Outbound communication to the host is blocked by a Firewall or network settings.`;
      case ConnectivityTest.AUTH:
        return `Invalid Token or Repeater ID, please make sure you are using the correct details provided to you.
          If you need further assistance, please reach out to your NeuraLegion technical support contact.`;
    }
  }
}
