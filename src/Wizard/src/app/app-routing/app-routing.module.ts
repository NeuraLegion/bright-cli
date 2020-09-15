import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DiagnosticsComponent } from '../components/diagnostics/diagnostics.component';
import { MainComponent } from '../components/main/main.component';

const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'diagnostics', component: DiagnosticsComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  declarations: []
})
export class AppRoutingModule {}
