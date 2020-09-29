import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';

export enum Status {
  SUCCESS = 'success',
  FAIL = 'fail'
}

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss']
})
export class ScanComponent implements OnInit {
  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService
  ) {}

  public targetForm: FormGroup;
  progressMsg: string;
  url: string;
  scanStarted: boolean;
  scanFinished: boolean;
  errorOccurred: boolean;
  currentColor: Status;

  get targetUrl(): AbstractControl {
    return this.targetForm.get('targetUrl');
  }

  ngOnInit(): void {
    this.scanStarted = false;
    this.scanFinished = false;
    this.errorOccurred = false;
    this.initForm();
    this.service.dataString$.subscribe((data) => {
      if (data) {
        this.url = data.url;
        this.progressMsg = data.progressMsg;
        this.currentColor = data.status;
        this.targetUrl.setValue(data.url);
      }
      if (this.currentColor === Status.SUCCESS) {
        this.scanFinished = true;
      } else {
        this.scanFinished = false;
      }
    });
  }

  initForm(): void {
    this.targetForm = this.formBuilder.group({
      targetUrl: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    this.scanStarted = true;
    this.scanFinished = false;
    this.url = `${this.targetUrl.value}`;
    if (!this.targetForm.valid) {
      console.log('Error, target URL is invalid');
    } else {
      this.resetValues();
      this.service.startScan({ url: this.url }).subscribe(
        (response: any) => {
          this.scanFinished = true;
          this.progressMsg = this.transform(200);
          this.currentColor = Status.SUCCESS;
          this.subscribeInfo(
            this.progressMsg,
            this.currentColor,
            response.scanId
          );
        },
        (error) => {
          this.errorOccurred = true;
          this.progressMsg = this.transform(error.status);
          this.currentColor = Status.FAIL;
          this.subscribeInfo(this.progressMsg, this.currentColor);
        }
      );
    }
  }

  subscribeInfo(message: string, status: string, scanId?: string): void {
    const scanInfo = {
      url: this.url,
      scanId,
      progressMsg: message,
      status
    };
    this.service.saveScanInfo(scanInfo);
  }

  prev(): void {
    this.router.navigateByUrl('diagnostics');
  }

  next(): void {
    this.router.navigateByUrl('success');
  }

  resetValues(): void {
    this.errorOccurred = false;
    this.progressMsg = '';
  }

  setCustomValidity(element, message): void {
    element.target.setCustomValidity(message);
  }

  transform(status: number): string | null {
    switch (status) {
      case 200:
        return `Communication test to ${this.url} completed successfully, and a demo scan has started, click on Next to continue.`;
      case 400:
        return `Please check that the target URL is valid. Connection to ${this.url} is blocked, please verify that the
        machine on which the Repeater is installed can reach the target server.
        Possible reasons for communication failure:
        ● Outbound communication to the host is blocked by a Firewall or network settings`;
      case 500:
        return `Connection to ${this.url} is blocked, please verify that the
        machine on which the Repeater is installed can reach the target server.
        Possible reasons for communication failure:
        ● Outbound communication to the host is blocked by a Firewall or network settings`;
    }
  }
}
