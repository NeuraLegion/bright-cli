import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HomeService {
  private homeVisited = new BehaviorSubject(false);

  public getHomeVisited(): Observable<boolean> {
    return this.homeVisited.asObservable();
  }

  public setHomeVisited(): void {
    this.homeVisited.next(true);
  }
}
