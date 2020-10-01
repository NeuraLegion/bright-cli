import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { HomeService } from './home.service';

@Injectable()
export class RouteGuard implements CanActivate {
  private static readonly HOME_PATH = '/';
  private static readonly DIAGNOSTICS_PATH = '/diagnostics';
  private static readonly SCAN_PATH = '/scan';
  private static readonly SUCCESS_PATH = '/success';

  constructor(private readonly router: Router,
              private readonly service: HomeService) {}

  canActivate(next: ActivatedRouteSnapshot): boolean {
    const currentRoute: string = this.router.url;
    const nextRoute = next.url[0]
      ? '/' + next.url[0].path
      : RouteGuard.HOME_PATH;

    switch (currentRoute) {
      case RouteGuard.HOME_PATH:
        return this.validateHomePath(nextRoute);
      case RouteGuard.DIAGNOSTICS_PATH:
        return this.validateDiagnosticPath(nextRoute);
      case RouteGuard.SCAN_PATH:
        return this.validateScanPath(nextRoute);
      case RouteGuard.SUCCESS_PATH:
        return this.validateSuccessPath(nextRoute);
      default:
        return true;
    }
  }

  private validateHomePath(nextRoute: string): boolean {
    if (nextRoute === RouteGuard.HOME_PATH) {
      this.service.setHomeVisited();
      return true;
    } else if (nextRoute === RouteGuard.DIAGNOSTICS_PATH && this.service.getHomeVisited()) {
      return true;
    } else {
      this.router.navigateByUrl(RouteGuard.HOME_PATH);
      return false;
    }
  }

  private validateDiagnosticPath(nextRoute: string): boolean {
    return nextRoute === RouteGuard.SCAN_PATH ||
      nextRoute === RouteGuard.HOME_PATH;
  }

  private validateScanPath(nextRoute: string): boolean {
    return nextRoute === RouteGuard.SUCCESS_PATH ||
      nextRoute === RouteGuard.DIAGNOSTICS_PATH;
  }

  private validateSuccessPath(nextRoute: string): boolean {
    return nextRoute === RouteGuard.SCAN_PATH;
  }
}
