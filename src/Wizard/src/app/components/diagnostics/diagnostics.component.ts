import { Component } from '@angular/core';

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss']
})

export class DiagnosticsComponent {
  checkbox = {
    amqConnection: true,
    httpsConnection: false,
    authValidation: false
  };
}
