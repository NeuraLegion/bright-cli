import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
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
              private formBuilder: FormBuilder,
              protected service: AppService) {}

  testsForm: FormGroup;
  protocol = new ProtocolMessage();
  status: ConnectivityStatus;

  ngOnInit() {
    this.initForm();
    this.restartTest();
  }

  initForm(): void{
    this.testsForm = this.formBuilder.group({
      tcp: new FormControl ({value: false, disabled: true}),
      http: new FormControl ({value: false, disabled: true}),
      auth: new FormControl ({value: false, disabled: true})
    });
  }

  restartTest(): void{
    this.resetValues();
    this.service.getConnectivityStatus({type: Protocol.TCP}).subscribe((tcpRes: any) => {
      this.testsForm.controls[Protocol.TCP].setValue(tcpRes.ok);
      this.status.tcp = tcpRes;
      this.updateMessages (tcpRes, Protocol.TCP);
      this.httpsMsg = `Validating that the connection to nexploit.app at port 443 is open`;
      this.service.getConnectivityStatus({type: Protocol.HTTP}).subscribe((httpRes: any) => {
        this.testsForm.controls[Protocol.HTTP].setValue(httpRes.ok);
        this.status.https = httpRes;
        this.updateMessages (httpRes, Protocol.HTTP);
        this.authMsg = 'Verifying provided Token and Repeater ID';
        this.service.getConnectivityStatus({type: Protocol.AUTH}).subscribe((authRes: any) => {
          this.testsForm.controls[Protocol.AUTH].setValue(authRes.ok);
          this.scanFinished = true;
          this.status.auth = authRes;
          this.updateMessages (authRes, Protocol.AUTH);
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

  updateMessages(response: any, id: string): void {
    if (response.ok) {
      response.msg = 'Success';
    } else {
      this.errorOccurred = true;
      switch (id) {
        case Protocol.TCP:
          response.msg = this.protocol.transform(Protocol.TCP);
          break;
        case Protocol.HTTP:
          response.msg = this.protocol.transform(Protocol.HTTP);
          break;
        case Protocol.AUTH:
          response.msg = this.protocol.transform(Protocol.AUTH);
          break;
      }
    }
  }

  resetValues(): void {
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
