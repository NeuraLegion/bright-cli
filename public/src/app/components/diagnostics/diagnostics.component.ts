import { AppService } from '../../services';
import { ConnectivityTest, ItemStatus } from '../../models';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { concat, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiagnosticsComponent implements OnInit, OnDestroy {
  public readonly connectivityTests = Object.values(ConnectivityTest);
  public readonly ConnectivityTest = ConnectivityTest;
  public readonly form: FormGroup;

  public processing = false;

  private readonly gc = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly service: AppService,
    private readonly cdr: ChangeDetectorRef,
    fb: FormBuilder
  ) {
    this.form = fb.group({
      [ConnectivityTest.TCP]: [null, [Validators.requiredTrue]],
      [ConnectivityTest.HTTP]: [null, [Validators.requiredTrue]],
      [ConnectivityTest.AUTH]: [null, [Validators.requiredTrue]]
    });
  }

  public ngOnInit(): void {
    this.restartTest();
  }

  public ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  public restartTest(): void {
    this.resetValues();
    this.processing = true;
    concat(
      ...Object.values(ConnectivityTest).map((type: ConnectivityTest) =>
        this.service.getConnectivityStatus(type)
      )
    )
      .pipe(takeUntil(this.gc))
      .subscribe(
        (status: ItemStatus): void => {
          this.form.get(status.type).setValue(status.ok);
          this.cdr.markForCheck();
        },
        () => {
          // noop
        },
        () => {
          this.processing = false;
          this.cdr.markForCheck();
        }
      );
  }

  public resetValues(): void {
    this.processing = false;
    this.connectivityTests.forEach((type: ConnectivityTest) =>
      this.form.get([type]).setValue(null)
    );
  }

  public next(): void {
    this.router.navigateByUrl('scan');
  }

  public prev(): void {
    this.router.navigateByUrl('');
  }

  public trackBy(_i: number, item: ConnectivityTest): ConnectivityTest {
    return item;
  }
}
