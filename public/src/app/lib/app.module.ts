import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from '../containers';
import {
  DiagnosticsComponent,
  MainComponent,
  ScanComponent,
  SecretFieldComponent,
  SuccessComponent
} from '../components';
import { WizardGuard } from '../guards';
import { ConnectivityPipe, StatusPipe } from '../pipes';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    ScanComponent,
    SuccessComponent,
    DiagnosticsComponent,
    SecretFieldComponent,
    ConnectivityPipe,
    StatusPipe
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule
  ],
  providers: [WizardGuard],
  bootstrap: [AppComponent]
})
export class AppModule {}
