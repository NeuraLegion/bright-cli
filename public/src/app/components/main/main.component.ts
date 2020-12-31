import { AppService } from '../../services';
import { Credentials, CustomValidators } from '../../models';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainComponent implements OnInit, OnDestroy {
  public readonly form: FormGroup;
  private readonly gc = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly service: AppService,
    private readonly cdr: ChangeDetectorRef,
    fb: FormBuilder
  ) {
    this.form = fb.group({
      authToken: ['', [Validators.required, CustomValidators.authToken]],
      repeaterId: ['', [Validators.required]]
    });
  }

  public ngOnInit(): void {
    this.service
      .getTokens()
      .pipe(takeUntil(this.gc))
      .subscribe((response: Credentials) => {
        this.form.patchValue(response);
        this.cdr.markForCheck();
      });
  }

  public ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  public onSubmit(): void {
    if (this.form.valid) {
      this.service
        .saveTokens(this.form.value)
        .pipe(takeUntil(this.gc))
        .subscribe(() => this.router.navigateByUrl('diagnostics'));
    }
  }
}
