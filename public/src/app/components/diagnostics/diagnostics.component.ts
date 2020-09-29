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

  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService
  ) {}

  public testsForm: FormGroup;
  private readonly protocolMessage = new ProtocolMessage();

  ngOnInit(): void {
    this.initForm();
    this.restartTest();
  }

  initForm(): void {
    this.testsForm = this.formBuilder.group({
      [Protocol.TCP]: [false, { disabled: true }],
      [Protocol.HTTP]: [false, { disabled: true }],
      [Protocol.AUTH]: [false, { disabled: true }]
    });
  }

  restartTest(): void {
    this.resetValues();
    forkJoin([
      this.service.getConnectivityStatus({ type: Protocol.TCP }),
      this.service.getConnectivityStatus({ type: Protocol.HTTP }),
      this.service.getConnectivityStatus({ type: Protocol.AUTH })
    ]).subscribe(([tcpRes, httpRes, authRes]) => {
      this.scanFinished = true;
      this.updateResponse(tcpRes, Protocol.TCP);
      this.updateResponse(httpRes, Protocol.HTTP);
      this.updateResponse(authRes, Protocol.AUTH);
    });
  }

  updateResponse(response: any, id: string): void {
    this.protocolTypes.forEach((type) => {
      if (type === id) {
        this.testsForm.get([type]).setValue(response.ok);
        if (response.ok) {
          this.responseMessage[type] = 'Success';
        } else {
          this.errorOccurred = true;
          this.responseMessage[type] = this.protocolMessage.transform(type);
        }
      }
    });
  }

  resetValues(): void {
    this.scanFinished = false;
    this.errorOccurred = false;
    this.protocolTypes.forEach((type) => {
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
