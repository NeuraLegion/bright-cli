import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HomeService {

  constructor() { }

  private static homeVisited = false;

  public getHomeVisited(): boolean {
    return HomeService.homeVisited;
  }

  public setHomeVisited(): void {
    HomeService.homeVisited = true;
  }
}
