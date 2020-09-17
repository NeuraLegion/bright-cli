import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectivityStatus } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss']
})

export class DiagnosticsComponent implements OnInit {

  constructor(private router: Router,
              protected service: AppService) {}

  status: ConnectivityStatus;

  ngOnInit() {
    this.service.getConnectivityStatus().subscribe((response: ConnectivityStatus) => {
      this.status = response;
    }, error => {
      console.log (error);
    });
  }

  restartScan(): void{ }

  next(): void {
    this.router.navigateByUrl('scan');
  }

  prev(): void {
    this.router.navigateByUrl('');
  }
}
