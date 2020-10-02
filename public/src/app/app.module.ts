import { AppRoutingModule } from './app-routing/app-routing.module';
import { AppComponent } from './app.component';
import { MainComponent } from './components/main/main.component';
import { ScanComponent } from './components/scan/scan.component';
import { DiagnosticsComponent } from './components/diagnostics/diagnostics.component';
import { RouteGuard } from './app-routing/RouteGuard';
import { ProtocolMessage } from './shared/ProtocolMessage';
import { StatusMessage } from './shared/StatusMessage';
import { ConnectivityMessage } from './shared/ConnectivityMessage';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    ScanComponent,
    DiagnosticsComponent,
    ProtocolMessage,
    StatusMessage,
    ConnectivityMessage
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule
  ],
  providers: [RouteGuard],
  bootstrap: [AppComponent]
})
export class AppModule {}
