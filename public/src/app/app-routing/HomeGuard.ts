export class HomeGuard {
  private static homeVisited: boolean = false;

  get homeVisited(): boolean {
      return HomeGuard.homeVisited;
  }

  set homeVisited(event: boolean) {
    HomeGuard.homeVisited = event;
  }
}
