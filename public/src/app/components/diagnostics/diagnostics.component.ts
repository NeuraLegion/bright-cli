import { Protocol } from '../../shared/ProtocolMessage';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { ItemStatus } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';
import { forkJoin } from 'rxjs';
import { Subject } from 'rxjs/internal/Subject';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss']
})
export class DiagnosticsComponent implements OnInit {
  public readonly protocolTypes = Object.values(Protocol);
  public readonly Protocol = Protocol;
  private readonly gc = new Subject<void>();

  errorOccurred = false;
  scanFinished = false;

  public testsForm: FormGroup;

  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService
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
    this.testsForm = this.formBuilder.group({
      [Protocol.TCP]: [null, { disabled: true }],
      [Protocol.HTTP]: [null, { disabled: true }],
      [Protocol.AUTH]: [null, { disabled: true }]
    });
  }

  restartTest(): void {
    this.resetValues();
    forkJoin([
      this.service.getConnectivityStatus({ type: Protocol.TCP }),
      this.service.getConnectivityStatus({ type: Protocol.HTTP }),
      this.service.getConnectivityStatus({ type: Protocol.AUTH })
    ]).pipe(takeUntil(this.gc)).subscribe(([tcpRes, httpRes, authRes]: ItemStatus[]): void => {
      this.scanFinished = true;
      this.updateResponse(tcpRes, Protocol.TCP);
      this.updateResponse(httpRes, Protocol.HTTP);
      this.updateResponse(authRes, Protocol.AUTH);
    });
  }

  updateResponse(response: ItemStatus, id: string): void {
    this.protocolTypes.forEach((type) => {
      if (type === id) {
        this.testsForm.get([type]).setValue(response.ok);
        if (!response.ok) {
          this.errorOccurred = true;
        }
      }
    });
  }

  resetValues(): void {
    this.scanFinished = false;
    this.errorOccurred = false;
    this.protocolTypes.forEach((type) => {
      this.testsForm.get([type]).setValue(null);
    });
  }

  next(): void {
    this.router.navigateByUrl('scan');
  }

  prev(): void {
    this.router.navigateByUrl('');
  }
}
