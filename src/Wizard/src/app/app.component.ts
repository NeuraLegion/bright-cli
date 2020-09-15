import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Connectivity Wizard';
  authToken: string;
  repeaterId: string;

  onSubmit(): void {
    const actionPayload = {
      authToken: this.authToken,
      repeaterId: this.repeaterId
    };
    console.log (actionPayload);
  }
}

