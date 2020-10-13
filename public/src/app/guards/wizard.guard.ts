import { HomeService } from '../services';
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Injectable()
export class WizardGuard implements CanActivate {
  private static readonly HOME_PATH = '/';
  private static readonly DIAGNOSTICS_PATH = '/diagnostics';
  private static readonly SCAN_PATH = '/scan';
  private static readonly SUCCESS_PATH = '/success';

  constructor(
    private readonly router: Router,
    private readonly service: HomeService
  ) {}

  canActivate(next: ActivatedRouteSnapshot): Observable<boolean> {
    return this.service.getHomeVisited().pipe(
      take(1),
      map((homeVisited: boolean) => {
        const currentRoute: string = this.router.url;
        const nextRoute = next.url[0]
          ? '/' + next.url[0].path
          : WizardGuard.HOME_PATH;

        switch (currentRoute) {
          case WizardGuard.HOME_PATH:
            return this.validateHomePath(nextRoute, homeVisited);
          case WizardGuard.DIAGNOSTICS_PATH:
            return this.validateDiagnosticPath(nextRoute);
          case WizardGuard.SCAN_PATH:
            return this.validateScanPath(nextRoute);
          case WizardGuard.SUCCESS_PATH:
            return this.validateSuccessPath(nextRoute);
          default:
            return true;
        }
      })
    );
  }

  private validateHomePath(nextRoute: string, homeVisited: boolean): boolean {
    if (nextRoute === WizardGuard.HOME_PATH) {
      this.service.setHomeVisited();

      return true;
    } else if (nextRoute === WizardGuard.DIAGNOSTICS_PATH && homeVisited) {
      return true;
    } else {
      this.router.navigateByUrl(WizardGuard.HOME_PATH);

      return false;
    }
  }

  private validateDiagnosticPath(nextRoute: string): boolean {
    return (
      nextRoute === WizardGuard.SCAN_PATH || nextRoute === WizardGuard.HOME_PATH
    );
  }

  private validateScanPath(nextRoute: string): boolean {
    return (
      nextRoute === WizardGuard.SUCCESS_PATH ||
      nextRoute === WizardGuard.DIAGNOSTICS_PATH
    );
  }

  private validateSuccessPath(nextRoute: string): boolean {
    return nextRoute === WizardGuard.SCAN_PATH;
  }
}
