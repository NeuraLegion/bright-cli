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
  tryMsg: string;
  scanFinished = false;
  errorOccurred = false;
  currentColor;

  ngOnInit() {
    this.initForm();
    this.service.dataString$.subscribe(
      data => {
        if (data) {
          this.tryMsg = data.tryMsg;
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
    this.color(this.currentColor);
  }

  initForm(): void{
    this.targetForm = this.formBuilder.group({
      targetUrl: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    this.scanFinished = false;
    if (this.targetForm.controls[TARGET_URL].value === null) {
      console.log('Error, target URL is invalid');
    } else {
      this.restartValues();
      this.tryMsg = `Trying to reach ${this.targetForm.controls[TARGET_URL].value}...`;
      this.service.startScan({url: this.targetForm.controls[TARGET_URL].value}).subscribe((response: any) => {
        this.scanFinished = true;
        this.progressMsg = `Communication test to ${this.targetForm.controls[TARGET_URL].value} completed successfully, and a demo scan has started, click on Next to continue.`;
        this.currentColor = Status.SUCCESS;
        this.color(this.currentColor);
        const scanInfo = {
          targetUrl: this.targetForm.controls[TARGET_URL].value,
          tryMsg: this.tryMsg,
          scanId: response.scanId,
          progressMsg: this.progressMsg,
          status: Status.SUCCESS
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
        this.color(this.currentColor);
        const scanInfo = {
          targetUrl: this.targetForm.controls[TARGET_URL].value,
          tryMsg: this.tryMsg,
          progressMsg: this.progressMsg,
          status: Status.FAIL
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

  color(status: string): void {
    const resp = document.querySelector(`#response-communication`);
    resp.classList.toggle(status);
  }

  restartValues(): void {
    if (this.currentColor) {
      this.color(this.currentColor);
    }
    this.errorOccurred = false;
    this.progressMsg = '';
  }
}
