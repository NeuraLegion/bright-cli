import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';

const TARGET_URL = 'targetUrl';
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

  constructor(private router: Router,
              private formBuilder: FormBuilder,
              protected service: AppService) {}

  targetForm: FormGroup;
  progressMsg: string;
  url: string;
  scanStarted;
  scanFinished = false;
  errorOccurred = false;
  currentColor;

  ngOnInit() {
    this.scanStarted = false;
    this.initForm();
    this.service.dataString$.subscribe(
      data => {
        if (data) {
          this.url = data.url;
          this.progressMsg = data.progressMsg;
          this.currentColor = data.status;
          this.targetForm.controls[TARGET_URL].setValue(data.targetUrl);
        }
        if (this.currentColor === Status.SUCCESS) {
          this.scanFinished = true;
        } else {
          this.scanFinished = false;
        }
      });
  }

  initForm(): void{
    this.targetForm = this.formBuilder.group({
      targetUrl: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    this.scanStarted = true;
    this.scanFinished = false;
    this.url = `${this.targetForm.controls[TARGET_URL].value}`;
    if (this.targetForm.controls[TARGET_URL].value === null) {
      console.log('Error, target URL is invalid');
    } else {
      this.resetValues();
      this.service.startScan({url: this.targetForm.controls[TARGET_URL].value}).subscribe((response: any) => {
        this.scanFinished = true;
        this.progressMsg = `Communication test to ${this.targetForm.controls[TARGET_URL].value} completed successfully, and a demo scan has started, click on Next to continue.`;
        this.currentColor = Status.SUCCESS;
        const scanInfo = {
          targetUrl: this.targetForm.controls[TARGET_URL].value,
          url: this.url,
          scanId: response.scanId,
          progressMsg: this.progressMsg,
          status: this.currentColor
        };
        this.service.saveScanInfo(scanInfo);
      }, error => {
        this.errorOccurred = true;
        switch (error.status) {
          case 400:
            this.progressMsg = `Please check that the target URL is valid. `;
            break;
          case 500:
            break;
        }
        this.progressMsg = this.progressMsg + `Connection to ${this.targetForm.controls[TARGET_URL].value} is blocked, please verify that the
        machine on which the Repeater is installed can reach the target server.
        Possible reasons for communication failure:
        ● Outbound communication to the host is blocked by a Firewall or network settings`;
        this.currentColor = Status.FAIL;
        const scanInfo = {
          targetUrl: this.targetForm.controls[TARGET_URL].value,
          url: this.url,
          progressMsg: this.progressMsg,
          status: this.currentColor
        };
        this.service.saveScanInfo(scanInfo);
      });
    }
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
}
