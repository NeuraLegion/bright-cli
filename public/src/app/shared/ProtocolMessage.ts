import { PipeTransform, Pipe } from '@angular/core';

export enum Protocol {
  TCP = 'tcp',
  HTTP = 'http',
  AUTH = 'auth'
}

@Pipe({
  name: 'protocol',
  pure: true
})
export class ProtocolMessage implements PipeTransform {
  public transform(protocol: Protocol): string | null {
    switch (protocol) {
      case Protocol.TCP:
        return `Connection to amq.nexploit.app:5672 is blocked, please verify that the machine on which the
          Repeater is installed can reach the remote server. Possible reasons for communication failure:
          ● Outbound communication to the host is blocked by a Firewall or network settings.`;
      case Protocol.HTTP:
        return `Connection to nexploit.app:443 is blocked, please verify that the machine on which the
          Repeater is installed can reach the remote server. Possible reasons for communication failure:
          ● Outbound communication to the host is blocked by a Firewall or network settings.`;
      case Protocol.AUTH:
        return `Invalid Token or Repeater ID, please make sure you are using the correct details provided to you.
          If you need further assistance, please reach out to your NeuraLegion technical support contact.`;
    }
  }
}
