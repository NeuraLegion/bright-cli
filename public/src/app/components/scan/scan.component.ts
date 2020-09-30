import { ScanId } from '../../../../../src/ConnectivityWizard/Entities/ScanId';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';
import { ProtocolMessage } from 'src/app/shared/ProtocolMessage';

export interface ScanInfo {
  url: string;
  scanId: string;
  progressMsg: string;
  status: Status;
}

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
  private readonly protocolMessage = new ProtocolMessage();
  public targetForm: FormGroup;
  progressMsg: string;
  url: string;
  scanStarted: boolean;
  scanFinished: boolean;
  errorOccurred: boolean;
  currentColor: Status;

  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService
  ) {}

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
        (response: ScanId) => {
          this.scanFinished = true;
          this.progressMsg = this.protocolMessage.set(200, this.url);
          this.currentColor = Status.SUCCESS;
          this.subscribeInfo(
            this.progressMsg,
            this.currentColor,
            response.scanId
          );
        },
        (error) => {
          this.errorOccurred = true;
          this.progressMsg = this.protocolMessage.set(error.status, this.url);
          this.currentColor = Status.FAIL;
          this.subscribeInfo(this.progressMsg, this.currentColor);
        }
      );
    }
  }

  subscribeInfo(message: string, status: Status, scanId?: string): void {
    const scanInfo: ScanInfo = {
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

  setCustomValidity(element: any, message: string): void {
    element.target.setCustomValidity(message);
  }
}
