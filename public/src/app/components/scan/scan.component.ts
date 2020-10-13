import { AppService } from '../../services';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
import { ScanInfo } from '../../models';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScanComponent implements OnInit {
  public targetForm: FormGroup;
  code: number;
  url: string;
  scanStarted: boolean;
  scanFinished: boolean;
  errorOccurred: boolean;

  private readonly gc = new Subject<void>();

  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService,
    private cdr: ChangeDetectorRef
  ) {}

  get targetUrl(): AbstractControl {
    return this.targetForm.get('targetUrl');
  }

  ngOnInit(): void {
    this.scanStarted = false;
    this.scanFinished = false;
    this.errorOccurred = false;
    this.initForm();
    this.service.dataString$.pipe(takeUntil(this.gc)).subscribe((data) => {
      if (data) {
        this.url = data.url;
        this.targetUrl.setValue(data.url);
        this.code = data.code;
      }
      if (this.code === 200) {
        this.scanFinished = true;
      } else {
        this.scanFinished = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  initForm(): void {
    this.targetForm = this.formBuilder.group({
      targetUrl: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    this.scanStarted = true;
    this.scanFinished = false;
    this.url = `${this.targetUrl.value}`;
    if (!this.targetForm.valid) {
      console.log('Error, target URL is invalid');
    } else {
      this.resetValues();
      this.service
        .startScan({ url: this.url })
        .pipe(takeUntil(this.gc))
        .subscribe(
          (scanId: string) => {
            this.scanFinished = true;
            this.code = 200;
            this.subscribeInfo(this.code, scanId);
            this.cdr.detectChanges();
          },
          (error) => {
            this.errorOccurred = true;
            this.code = error.status;
            this.subscribeInfo(this.code);
            this.cdr.detectChanges();
          }
        );
    }
  }

  subscribeInfo(code: number, scanId?: string): void {
    const scanInfo: ScanInfo = {
      url: this.url,
      scanId,
      code
    };
    this.service.saveScanInfo(scanInfo);
  }

  prev(): void {
    this.router.navigateByUrl('diagnostics');
  }

  next(): void {
    this.router.navigateByUrl('success');
  }

  resetValues(): void {
    this.code = null;
    this.errorOccurred = false;
  }

  setCustomValidity(element: any, message: string): void {
    element.target.setCustomValidity(message);
  }
}
