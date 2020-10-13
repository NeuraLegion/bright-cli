import { ConnectivityTest } from '../models';
import { ScanInfo } from '../models';
import { Credentials } from '../models';
import { ItemStatus } from '../models';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  // Observable string stream
  public dataString$: Observable<ScanInfo>;

  // Observable string source
  private dataStringSource: BehaviorSubject<ScanInfo>;

  constructor(private readonly http: HttpClient) {
    this.dataStringSource = new BehaviorSubject<ScanInfo>(undefined);
    this.dataString$ = this.dataStringSource.asObservable();
  }

  getTokens(): Observable<Credentials> {
    return this.http.get<Credentials>(`/api/tokens`);
  }

  saveTokens(payload: Credentials): Observable<Credentials> {
    return this.http.post<Credentials>(`api/tokens`, payload);
  }

  getConnectivityStatus(type: ConnectivityTest): Observable<ItemStatus> {
    return this.http.post<ItemStatus>(`/api/connectivity-status`, { type });
  }

  startScan(settings: { url: string }): Observable<string> {
    return this.http
      .post<{ scanId: string }>(`/api/scan`, settings)
      .pipe(map(({ scanId }: { scanId: string }) => scanId));
  }

  finishProcess(): Observable<void> {
    return this.http.post<void>(`api/finish`, {});
  }

  saveScanInfo(value: ScanInfo): void {
    this.dataStringSource.next(value);
  }
}
