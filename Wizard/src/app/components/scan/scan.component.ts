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

  ngOnInit() {
    this.service.dataString$.subscribe(
      data => {
        if (data) {
          this.scanStarted = true;
          this.targetUrl = data.targetUrl;
          this.tryMsg = data.tryMsg;
          this.progressMsg = data.progressMsg;
          this.color(data.status);
        }
      });
  }

  onSubmit(): void {
    this.tryMsg = `Trying to reach ${this.targetUrl}...`;
    this.service.startScan(this.targetUrl).subscribe((response: any) => {
      this.scanStarted = true;
      this.progressMsg = `Communication test to ${this.targetUrl} completed successfully, and a demo scan has
      started, click on Next to continue.`;
      const scanInfo = {
        targetUrl: this.targetUrl,
        tryMsg: this.tryMsg,
        scanId: response.scanId,
        progressMsg: this.progressMsg,
        status: 'success'
      };
      this.service.saveScanInfo(scanInfo);
    }, error => {
      this.scanStarted = true;
      this.progressMsg = `Connection to ${this.targetUrl} is blocked, please verify that the machine on
      which the Repeater is installed can reach the target server.
      Possible reasons for communication failure:
      ● Outbound communication to the host is blocked by a Firewall or network
      settings`;
      const scanInfo = {
        targetUrl: this.targetUrl,
        tryMsg: this.tryMsg,
        progressMsg: this.progressMsg,
        status: 'fail'
      };
      this.service.saveScanInfo(scanInfo);
      console.log (error);
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
}
