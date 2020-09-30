import { PipeTransform, Pipe } from '@angular/core';
import { Protocol } from './ProtocolMessage';

@Pipe({
  name: 'connectivity',
  pure: true
})
export class ConnectivityMessage implements PipeTransform {
    public transform(protocol: Protocol): string | null {
        switch (protocol) {
          case Protocol.TCP:
            return `Validating that the connection to amq.nexploit.app at port 5672 is open`;
          case Protocol.HTTP:
            return `Validating that the connection to nexploit.app at port 443 is open`;
          case Protocol.AUTH:
            return `Verifying provided Token and Repeater ID`;
        }
    }
}
