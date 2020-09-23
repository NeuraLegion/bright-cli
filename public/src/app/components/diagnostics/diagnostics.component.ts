import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectivityStatus } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';
import { ProtocolMessage, Protocol } from '../../shared/ProtocolMessage';

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss']
})

export class DiagnosticsComponent implements OnInit {

  tcpMsg = 'Validating that the connection to amq.nexploit.app at port 5672 is open';
  errorOccurred = false;
  httpsMsg = '';
  authMsg = '';
  scanFinished = false;

  constructor(private router: Router,
              protected service: AppService) {}

  protocol = new ProtocolMessage();
  status: ConnectivityStatus;

  ngOnInit() {
    this.restartTest(true);
  }

  restartTest(sourceInit: boolean): void{
    this.restartValues();
    this.service.getConnectivityStatus({type: 'tcp'}).subscribe((tcpRes: any) => {
      this.status.tcp = tcpRes;
      this.colorMessages (tcpRes, 'tcp');
      if (!sourceInit) {
        this.colorMessages (tcpRes, 'tcp');
      }
      this.httpsMsg = `Validating that the connection to nexploit.app at port 443 is open`;
      this.service.getConnectivityStatus({type: 'http'}).subscribe((httpRes: any) => {
        this.status.https = httpRes;
        this.colorMessages (httpRes, 'http');
        if (!sourceInit) {
          this.colorMessages (httpRes, 'http');
        }
        this.authMsg = 'Verifying provided Token and Repeater ID';
        this.service.getConnectivityStatus({type: 'auth'}).subscribe((authRes: any) => {
          this.scanFinished = true;
          this.status.auth = authRes;
          this.colorMessages (authRes, 'auth');
          if (!sourceInit) {
            this.colorMessages (authRes, 'auth');
          }
        }, error => {
          console.log (error);
        });
      }, error => {
        console.log (error);
      });
    }, error => {
      console.log (error);
    });
  }

  colorMessages(response: any, id: string): void {
    const msg = document.querySelector(`#${id}`);
    if (response.ok) {
      response.msg = 'Success';
      msg.classList.toggle('success');
    } else {
      this.errorOccurred = true;
      switch (id) {
        case 'tcp':
          response.msg = this.protocol.transform(Protocol.TCP);
          break;
        case 'http':
          response.msg = this.protocol.transform(Protocol.HTTP);
          break;
        case 'auth':
          response.msg = this.protocol.transform(Protocol.AUTH);
          break;
      }
      msg.classList.toggle('fail');
    }
  }

  restartValues(): void {
    this.scanFinished = false;
    this.httpsMsg = '';
    this.authMsg = '';
    this.status = {
      auth: { ok: false },
      https: { ok: false },
      tcp: { ok: false }
    };
  }

  next(): void {
    this.router.navigateByUrl('scan');
  }

  prev(): void {
    this.router.navigateByUrl('');
  }
}
