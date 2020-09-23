import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectivityStatus } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';

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

  failure = {
    tcp: `Connection to amq.nexploit.app:5672 is blocked, please verify that the machine on which the
    Repeater is installed can reach the remote server. Possible reasons for communication failure:
    ● Outbound communication to the host is blocked by a Firewall or network settings.`,
    http: `Connection to nexploit.app:443 is blocked, please verify that the machine on which the 
    Repeater is installed can reach the remote server. Possible reasons for communication failure:
    ● Outbound communication to the host is blocked by a Firewall or network settings.`,
    auth: `Invalid Token or Repeater ID , please make sure you are using the correct details provided to you.
    If you need further assistance, please reach out to your NeuraLegion technical support contact.`
  };

  constructor(private router: Router,
              protected service: AppService) {}

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
          response.msg = this.failure.tcp;
          break;
        case 'http':
          response.msg = this.failure.http;
          break;
        case 'auth':
          response.msg = this.failure.auth;
          break;
      }
      msg.classList.toggle('fail');
    }
  }

  restartValues(): void {
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
