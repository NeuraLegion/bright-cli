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

  onIconClick(inputId, spanId): void {
    const toggleEye = document.querySelector(`#${spanId}`);
    const inputField = document.querySelector(`#${inputId}`);

    const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
    inputField.setAttribute('type', type);
    toggleEye.classList.toggle('fa-eye-slash');
  }
}

