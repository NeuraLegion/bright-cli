import { ItemStatus, Scan, Tokens } from './app.model';
import { ScannedUrl } from '../../../src/ConnectivityWizard/Entities/ScannedUrl';
import { ConnectivityTest } from '../../../src/ConnectivityWizard/Entities/ConnectivityTest';
import { ScanInfo } from './components/scan/scan.component';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  // Observable string stream
  public dataString$: Observable<ScanInfo>;

  // Observable string source
  private dataStringSource: BehaviorSubject<ScanInfo>;

  constructor(private readonly http: HttpClient) {
    this.dataStringSource = new BehaviorSubject<any>(undefined);
    this.dataString$ = this.dataStringSource.asObservable();
  }

  getTokens(): Observable<Tokens> {
    return this.http.get<Tokens>(`/api/tokens`);
  }

  saveTokens(payload: Tokens): Observable<Tokens> {
    return this.http.post<Tokens>(`api/tokens`, payload);
  }

  getConnectivityStatus(type: ConnectivityTest): Observable<ItemStatus> {
    return this.http.post<ItemStatus>(`/api/connectivity-status`, type);
  }

  startScan(payload: ScannedUrl): Observable<Scan> {
    return this.http.post<Scan>(`/api/scan`, payload);
  }

  finishProcess(): Observable<void> {
    return this.http.post<void>(`api/finish`, {});
  }

  saveScanInfo(value: ScanInfo): void {
    this.dataStringSource.next(value);
  }
}
