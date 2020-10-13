import { AppService } from '../../services';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CustomValidators, ScanInfo } from '../../models';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScanComponent implements OnInit, OnDestroy {
  public readonly form: FormGroup;
  public code: number;
  public url: string;
  public scanStarted: boolean;
  public scanFinished: boolean;
  public errorOccurred: boolean;

  private readonly gc = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly service: AppService,
    private readonly cdr: ChangeDetectorRef,
    fb: FormBuilder
  ) {
    this.form = fb.group({
      url: ['', [Validators.required, CustomValidators.url]]
    });
  }

  public ngOnInit(): void {
    this.scanStarted = false;
    this.scanFinished = false;
    this.errorOccurred = false;
    this.service.scan$
      .pipe(takeUntil(this.gc))
      .subscribe((data: ScanInfo | undefined) => {
        if (data) {
          this.url = data.url;
          this.code = data.code;
          this.form.patchValue({ url: data.url });
        }

        this.scanFinished = this.code === 200;
        this.cdr.markForCheck();
      });
  }

  public ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  public onSubmit(): void {
    this.scanStarted = true;
    this.scanFinished = false;

    if (this.form.valid) {
      this.resetValues();
      this.service
        .startScan(this.form.value)
        .pipe(takeUntil(this.gc))
        .subscribe(
          (scanId: string) => {
            this.scanFinished = true;
            this.code = 200;
            this.subscribeInfo(this.code, scanId);
            this.cdr.markForCheck();
          },
          (error: HttpErrorResponse) => {
            this.errorOccurred = true;
            this.code = error.status;
            this.subscribeInfo(this.code);
            this.cdr.markForCheck();
          }
        );
    }
  }

  public subscribeInfo(code: number, scanId?: string): void {
    this.service.saveScanInfo({
      ...this.form.value,
      scanId,
      code
    });
  }

  public prev(): void {
    this.router.navigateByUrl('diagnostics');
  }

  public next(): void {
    this.router.navigateByUrl('success');
  }

  public resetValues(): void {
    this.code = null;
    this.errorOccurred = false;
  }
}
