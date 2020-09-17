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

  onSubmit(): void { 
    this.service.startScan(this.targetUrl).subscribe((response: any) => {
      console.log (response);
    }, error => {
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
