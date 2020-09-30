import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';
import { Subject } from 'rxjs/internal/Subject';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.scss']
})
export class SuccessComponent implements OnInit {
  private readonly gc = new Subject<void>();
  public scanId: string;
  public processFinished: boolean;

  constructor(
    private readonly router: Router,
    private readonly service: AppService
  ) {}

  ngOnInit(): void {
    this.processFinished = false;
    this.service.dataString$.subscribe((data) => {
      this.scanId = data.scanId;
    });
  }

  ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  finish(): void {
    this.service.finishProcess().pipe(takeUntil(this.gc)).subscribe(
      () => {
        console.log('/finish call completed');
      },
      (error) => {
        console.log(error);
        this.processFinished = true;
        alert('Wizard Completed! Do not close console window.');
      }
    );
  }

  prev(): void {
    this.router.navigateByUrl('scan');
  }
}
