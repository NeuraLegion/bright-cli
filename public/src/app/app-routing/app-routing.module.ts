import { RouteGuard } from './RouteGuard';
import { DiagnosticsComponent } from '../components/diagnostics/diagnostics.component';
import { MainComponent } from '../components/main/main.component';
import { ScanComponent } from '../components/scan/scan.component';
import { SuccessComponent } from '../components/success/success.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', component: MainComponent, canActivate: [RouteGuard] },
  {
    path: 'diagnostics',
    component: DiagnosticsComponent,
    canActivate: [RouteGuard]
  },
  { path: 'scan', component: ScanComponent, canActivate: [RouteGuard] },
  { path: 'success', component: SuccessComponent, canActivate: [RouteGuard] }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  declarations: []
})
export class AppRoutingModule {}
