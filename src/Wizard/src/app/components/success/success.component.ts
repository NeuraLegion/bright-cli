import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.scss']
})
export class SuccessComponent implements OnInit {

  scanId: string;

  constructor(private router: Router,
              protected service: AppService) {}

  ngOnInit() {
    this.service.dataString$.subscribe(
      data => {
        this.scanId = data;
      });
  }

  finish(): void {
    this.service.finishProcess({}).subscribe((response: any) => {
      console.log (response);
    }, error => {
      console.log (error);
      alert('Wizard Completed! Do not close console window.');
    });
  }

  prev(): void {
    this.router.navigateByUrl('scan');
  }

}
