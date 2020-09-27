import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { ConnectivityResponse } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';
import { ProtocolMessage, Protocol } from '../../shared/ProtocolMessage';
import { forkJoin } from 'rxjs';

export enum ConnectivityMessages {
  tcp = 'Validating that the connection to amq.nexploit.app at port 5672 is open',
  http = 'Validating that the connection to nexploit.app at port 443 is open',
  auth = 'Verifying provided Token and Repeater ID'
}

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss']
})

export class DiagnosticsComponent implements OnInit {

  public readonly protocolTypes = Object.values(Protocol);
  public readonly connectivityMessages = Object.values(ConnectivityMessages);

  errorOccurred = false;
  scanFinished = false;

  responseMessage: ConnectivityResponse = {
    tcp: null,
    http: null,
    auth: null
  };

  constructor(private router: Router,
              private formBuilder: FormBuilder,
              private readonly service: AppService) {}

  testsForm: FormGroup;
  protocol = new ProtocolMessage();

  ngOnInit() {
    this.initForm();
    this.restartTest();
  }

  initForm(): void{
    this.testsForm = this.formBuilder.group({
      [Protocol.TCP]: [false, { disabled: true }],
      [Protocol.HTTP]: [false, { disabled: true }],
      [Protocol.AUTH]: [false, { disabled: true }]
    });
  }

  restartTest(): void {
    console.log (this.protocolTypes);
    console.log (this.connectivityMessages);

    this.resetValues();
    forkJoin([
      this.service.getConnectivityStatus({type: Protocol.TCP}),
      this.service.getConnectivityStatus({type: Protocol.HTTP}),
      this.service.getConnectivityStatus({type: Protocol.AUTH})]
    )
    .subscribe(([tcpRes, httpRes, authRes]) => {
      this.scanFinished = true;

      this.testsForm.get([Protocol.TCP]).setValue(tcpRes.ok);
      this.updateMessages (tcpRes, Protocol.TCP);

      this.testsForm.get([Protocol.HTTP]).setValue(httpRes.ok);
      this.updateMessages (httpRes, Protocol.HTTP);

      this.testsForm.get([Protocol.AUTH]).setValue(authRes.ok);
      this.updateMessages (authRes, Protocol.AUTH);
    });
  }

  updateMessages(response: any, id: string): void {
      switch (id) {
        case Protocol.TCP:
          if (response.ok) {
            this.responseMessage.tcp = 'Success';
          } else {
            this.errorOccurred = true;
            this.responseMessage.tcp = this.protocol.transform(Protocol.TCP);
          }
          break;
        case Protocol.HTTP:
          if (response.ok) {
            this.responseMessage.http = 'Success';
          } else {
            this.errorOccurred = true;
            this.responseMessage.http = this.protocol.transform(Protocol.HTTP);
          }
          break;
        case Protocol.AUTH:
          if (response.ok) {
            this.responseMessage.auth = 'Success';
          } else {
            this.errorOccurred = true;
            this.responseMessage.auth = this.protocol.transform(Protocol.AUTH);
          }
          break;
        }
  }

  resetValues(): void {
    this.scanFinished = false;
    this.errorOccurred = false;
    this.protocolTypes.forEach(type => {
      this.testsForm.get([type]).setValue(false);
    });
    this.responseMessage = {
      auth: null,
      http: null,
      tcp: null
    };
  }

  next(): void {
    this.router.navigateByUrl('scan');
  }

  prev(): void {
    this.router.navigateByUrl('');
  }
}
