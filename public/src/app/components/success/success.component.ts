import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from '../../services';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ScanInfo } from '../../models';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuccessComponent implements OnInit, OnDestroy {
  public scanId: string;
  public processFinished: boolean;

  private readonly gc = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly service: AppService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.processFinished = false;
    this.service.scan$.pipe(takeUntil(this.gc)).subscribe((data: ScanInfo) => {
      this.scanId = data.scanId;
      this.cdr.markForCheck();
    });
  }

  public ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  public finish(): void {
    this.service
      .finishProcess()
      .pipe(takeUntil(this.gc))
      .subscribe(
        () => {
          this.processFinished = true;
        },
        () => {
          this.processFinished = true;
          alert('Wizard Completed! Do not close console window.');
        }
      );
  }

  public prev(): void {
    this.router.navigateByUrl('scan');
  }
}
