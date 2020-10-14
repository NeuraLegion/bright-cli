import { ConnectivityTest, Credentials, ItemStatus, ScanInfo } from '../models';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private readonly scan = new BehaviorSubject<ScanInfo>(undefined);
  public scan$ = this.scan.asObservable();

  constructor(private readonly http: HttpClient) {}

  public getTokens(): Observable<Credentials> {
    return this.http.get<Credentials>('/api/tokens');
  }

  public saveTokens(payload: Credentials): Observable<Credentials> {
    return this.http.post<Credentials>('api/tokens', payload);
  }

  public getConnectivityStatus(type: ConnectivityTest): Observable<ItemStatus> {
    return this.http
      .post<ItemStatus>('/api/connectivity-status', { type })
      .pipe(map((res: ItemStatus) => ({ ...res, type })));
  }

  public startScan(settings: { url: string }): Observable<string> {
    return this.http
      .post<{ scanId: string }>('/api/scan', settings)
      .pipe(map(({ scanId }: { scanId: string }) => scanId));
  }

  public finishProcess(): Observable<void> {
    return this.http.post<void>('api/finish', {});
  }

  public saveScanInfo(value: ScanInfo): void {
    this.scan.next(value);
  }
}
