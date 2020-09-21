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
  httpsMsg = '';
  authMsg = '';

  constructor(private router: Router,
              protected service: AppService) {}

  status: ConnectivityStatus;

  ngOnInit() {
    this.restartTest();
  }

  restartTest(): void{
    this.restartValues();
    this.service.getConnectivityStatus({type: 'tcp'}).subscribe((tcpRes: any) => {
      this.status.tcp = tcpRes;
      this.httpsMsg = 'Validating that the connection to nexploit.app at port 443 is open';
      this.service.getConnectivityStatus({type: 'http'}).subscribe((httpRes: any) => {
        this.status.https = httpRes;
        this.authMsg = 'Verifying provided Token and Repeater ID';
        this.service.getConnectivityStatus({type: 'auth'}).subscribe((authRes: any) => {
          this.status.auth = authRes;
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
