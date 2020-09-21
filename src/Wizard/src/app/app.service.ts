import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  constructor(private http: HttpClient) {}

  // Observable string source
  private dataStringSource = new BehaviorSubject<any>(undefined);
  // Observable string stream
  dataString$ = this.dataStringSource.asObservable();

  getTokens(): Observable<any> {
    return this.http.get<any>(`/api/tokens`);
  }

  saveTokens(payload: any): Observable<any> {
    return this.http.post<any>(`api/tokens`, payload);
  }

  getConnectivityStatus(type: any): Observable<any> {
    return this.http.post<any>(`/api/connectivty-status`, type);
  }

  startScan(payload: any): Observable<any> {
    return this.http.post<any>(`/api/scan`, payload);
  }

  finishProcess(payload: any): Observable<any> {
    return this.http.post<any>(`api/finish`, payload);
  }

  saveScanId(value): void{
    this.dataStringSource.next(value);
  }
}
