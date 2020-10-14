import { WizardGuard } from '../guards';
import {
  DiagnosticsComponent,
  MainComponent,
  ScanComponent,
  SuccessComponent
} from '../components';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', component: MainComponent, canActivate: [WizardGuard] },
  {
    path: 'diagnostics',
    component: DiagnosticsComponent,
    canActivate: [WizardGuard]
  },
  { path: 'scan', component: ScanComponent, canActivate: [WizardGuard] },
  { path: 'success', component: SuccessComponent, canActivate: [WizardGuard] },
  { path: '**', component: MainComponent, canActivate: [WizardGuard] }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  declarations: []
})
export class AppRoutingModule {}
