import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent {
  title = 'Connectivity Wizard';
  authToken: string;
  repeaterId: string;

  constructor(private router: Router) {}

  onSubmit(): void {
    const actionPayload = {
      authToken: this.authToken,
      repeaterId: this.repeaterId
    };
    this.router.navigateByUrl('diagnostics');
  }
}

