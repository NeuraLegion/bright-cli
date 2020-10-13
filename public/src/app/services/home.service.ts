import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

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
