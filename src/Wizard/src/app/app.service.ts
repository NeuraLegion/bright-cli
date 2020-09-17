import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  constructor(private http: HttpClient) {}

  getTokens(): Observable<any> {
    return this.http.get<any>(`/api/tokens`);
  }

  saveTokens(payload: any): Observable<any> {
    return this.http.post<any>(`api/tokens`, payload);
  }

  getConnectivityStatus(): Observable<any> {
    return this.http.get<any>(`/api/connectivty-status`);
  }

  startScan(payload: any): Observable<any> {
    return this.http.post<any>(`/api/scan`, payload);
  }
}
