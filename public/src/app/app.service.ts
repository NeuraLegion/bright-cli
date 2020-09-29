import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { ItemStatus, Scan, Tokens } from './app.model';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  constructor(private readonly http: HttpClient) {}

  // Observable string source
  private dataStringSource = new BehaviorSubject<any>(undefined);
  // Observable string stream
  dataString$ = this.dataStringSource.asObservable();

  getTokens(): Observable<Tokens> {
    return this.http.get<Tokens>(`/api/tokens`);
  }

  saveTokens(payload: any): Observable<Tokens> {
    return this.http.post<Tokens>(`api/tokens`, payload);
  }

  getConnectivityStatus(type: any): Observable<ItemStatus> {
    return this.http.post<ItemStatus>(`/api/connectivity-status`, type);
  }

  startScan(payload: any): Observable<Scan> {
    return this.http.post<Scan>(`/api/scan`, payload);
  }

  finishProcess(payload: any): Observable<any> {
    return this.http.post<any>(`api/finish`, payload);
  }

  saveScanInfo(value): void {
    this.dataStringSource.next(value);
  }
}
