import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DiagnosticsComponent } from '../components/diagnostics/diagnostics.component';
import { MainComponent } from '../components/main/main.component';
import { ScanComponent } from '../components/scan/scan.component';
import { SuccessComponent } from '../components/success/success.component';

const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'diagnostics', component: DiagnosticsComponent },
  { path: 'scan', component: ScanComponent },
  { path: 'success', component: SuccessComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  declarations: []
})
export class AppRoutingModule {}
