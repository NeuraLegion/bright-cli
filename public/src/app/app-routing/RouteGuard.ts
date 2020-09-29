import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';

export enum Path {
    HOME = '/',
    DIAGNOSTICS = 'diagnostics',
    SCAN = 'scan',
    SUCCESS = 'success'
}

@Injectable()
export class RouteGuard implements CanActivate {

    constructor(private readonly router: Router) {}

    canActivate(next: ActivatedRouteSnapshot): boolean {
        const currentRoute = this.router.url;
        const nextRoute = next.url[0] ? next.url[0].path : Path.HOME;
        switch (currentRoute) {
            case `/${Path.DIAGNOSTICS}`:
                if ((nextRoute === Path.SCAN) || (nextRoute === Path.HOME)) {
                    return true;
                } else {
                    return false;
                }
            case `/${Path.SCAN}`:
                if ((nextRoute === Path.SUCCESS) || (nextRoute === Path.DIAGNOSTICS)) {
                    return true;
                } else {
                    return false;
                }
            case `/${Path.SUCCESS}`:
                if (nextRoute === Path.SCAN) {
                    return true;
                } else {
                    return false;
                }
            default:
                return true;
        }
    }
}
