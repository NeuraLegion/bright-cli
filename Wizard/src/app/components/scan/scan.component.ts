import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss']
})

export class ScanComponent implements OnInit {

  constructor(private router: Router,
              protected service: AppService) {}

  targetUrl: string = '{{url}}';
  progressMsg = '';
  tryMsg = '';
  scanStarted = false;
  errorOccurred = false;

  ngOnInit() {
    this.service.dataString$.subscribe(
      data => {
        if (data) {
          this.scanStarted = true;
          this.targetUrl = data.targetUrl;
          this.tryMsg = data.tryMsg;
          this.progressMsg = data.progressMsg;
        }
      });
  }

  onSubmit(): void {
    this.restartValues();
    this.tryMsg = `Trying to reach ${this.targetUrl}...`;
    this.scanStarted = true;
    this.service.startScan({url: this.targetUrl}).subscribe((response: any) => {
      this.color('success');
      this.progressMsg = `Communication test to ${this.targetUrl} completed successfully, and a demo scan has
      started, click on Next to continue.`;
      const scanInfo = {
        targetUrl: this.targetUrl,
        tryMsg: this.tryMsg,
        scanId: response.scanId,
        progressMsg: this.progressMsg
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
      this.color('fail');
      this.progressMsg = this.progressMsg + `Connection to ${this.targetUrl} is blocked, please verify that the machine on
      which the Repeater is installed can reach the target server.
      Possible reasons for communication failure:
      ● Outbound communication to the host is blocked by a Firewall or network
      settings`;
    });
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
    if (this.errorOccurred) {
      this.color('fail');
    } else if (this.scanStarted) {
      this.color('success');
    }
    this.errorOccurred = false;
    this.progressMsg = '';
  }
}
