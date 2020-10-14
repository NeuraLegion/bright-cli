import { PipeTransform, Pipe } from '@angular/core';

@Pipe({
  name: 'status',
  pure: true
})
export class StatusPipe implements PipeTransform {
  public transform(status: number, url: string): string | null {
    switch (status) {
      case 200:
        // eslint-disable-next-line max-len
        return `Communication test to ${url} completed successfully, and a demo scan has started, click on Next to continue.`;
      case 400:
        return `Please check that the target URL is valid. Connection to ${url} is blocked, please verify that the
            machine on which the Repeater is installed can reach the target server.
            Possible reasons for communication failure:
            ● Outbound communication to the host is blocked by a Firewall or network settings`;
      case 500:
        return `Connection to ${url} is blocked, please verify that the
            machine on which the Repeater is installed can reach the target server.
            Possible reasons for communication failure:
            ● Outbound communication to the host is blocked by a Firewall or network settings`;
    }
  }
}
