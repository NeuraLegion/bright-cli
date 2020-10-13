import { AppService } from '../../services';
import { ConnectivityTest, ItemStatus } from '../../models';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiagnosticsComponent implements OnInit {
  public readonly connectivityTests = Object.values(ConnectivityTest);
  public readonly ConnectivityTest = ConnectivityTest;
  public form: FormGroup;

  errorOccurred = false;
  scanFinished = false;

  private readonly gc = new Subject<void>();

  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.restartTest();
  }

  ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  initForm(): void {
    this.form = this.formBuilder.group({
      [ConnectivityTest.TCP]: [null, { disabled: true }],
      [ConnectivityTest.HTTP]: [null, { disabled: true }],
      [ConnectivityTest.AUTH]: [null, { disabled: true }]
    });
  }

  restartTest(): void {
    this.resetValues();
    forkJoin(
      [
        ConnectivityTest.TCP,
        ConnectivityTest.HTTP,
        ConnectivityTest.AUTH
      ].map((type: ConnectivityTest) =>
        this.service.getConnectivityStatus(type)
      )
    )
      .pipe(takeUntil(this.gc))
      .subscribe(([tcpRes, httpRes, authRes]: ItemStatus[]): void => {
        this.scanFinished = true;
        this.updateResponse(tcpRes, ConnectivityTest.TCP);
        this.updateResponse(httpRes, ConnectivityTest.HTTP);
        this.updateResponse(authRes, ConnectivityTest.AUTH);
        this.cdr.detectChanges();
      });
  }

  updateResponse(response: ItemStatus, id: string): void {
    this.connectivityTests.forEach((type) => {
      if (type === id) {
        this.form.get([type]).setValue(response.ok);
        if (!response.ok) {
          this.errorOccurred = true;
        }
      }
    });
  }

  resetValues(): void {
    this.scanFinished = false;
    this.errorOccurred = false;
    this.connectivityTests.forEach((type) => {
      this.form.get([type]).setValue(null);
    });
  }

  next(): void {
    this.router.navigateByUrl('scan');
  }

  prev(): void {
    this.router.navigateByUrl('');
  }
}
