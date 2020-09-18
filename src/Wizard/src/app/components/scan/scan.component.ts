import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss']
})

export class ScanComponent {

  constructor(private router: Router,
              protected service: AppService) {}

  targetUrl: string = '{{url}}';
  progressMsg = '';
  tryMsg = '';
  scanStarted = false;

  onSubmit(): void {
    this.tryMsg = `Trying to reach ${this.targetUrl}...`;
    this.service.startScan(this.targetUrl).subscribe((response: any) => {
      this.scanStarted = true;
      this.service.saveScanId(response.scanId);
      this.progressMsg = `Communication test to ${this.targetUrl} completed successfully, and a demo scan has
      started, click on Next to continue.`;
    }, error => {
      this.progressMsg = `Connection to ${this.targetUrl} is blocked, please verify that the machine on
      which the Repeater is installed can reach the target server.
      Possible reasons for communication failure:
      ● Outbound communication to the host is blocked by a Firewall or network
      settings`;
      console.log (error);
    });
  }

  prev(): void {
    this.router.navigateByUrl('diagnostics');
  }

  next(): void {
    this.router.navigateByUrl('success');
  }
}
