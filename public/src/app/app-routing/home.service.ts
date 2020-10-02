import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class HomeService {
  private static homeVisited = new BehaviorSubject(false);

  public getHomeVisited(): Observable<boolean> {
    return HomeService.homeVisited.asObservable();
  }

  public setHomeVisited(): void {
    HomeService.homeVisited.next(true);
  }
}
