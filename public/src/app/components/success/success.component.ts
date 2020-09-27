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
  processFinished: boolean;

  constructor(private readonly router: Router,
              private readonly service: AppService) {}

  ngOnInit() {
    this.processFinished = false;
    this.service.dataString$.subscribe(
      data => {
        this.scanId = data.scanId;
      });
  }

  finish(): void {
    this.service.finishProcess({}).subscribe((response: any) => {
      console.log (response);
    }, error => {
      console.log (error);
      this.processFinished = true;
      alert('Wizard Completed! Do not close console window.');
    });
  }

  prev(): void {
    this.router.navigateByUrl('scan');
  }

}
