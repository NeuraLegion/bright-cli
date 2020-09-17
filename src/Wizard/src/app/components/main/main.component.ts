import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  title = 'Connectivity Wizard';
  authToken: string;
  repeaterId: string;

  constructor(private router: Router,
              protected service: AppService) {}

  ngOnInit() {
    console.log('Welcome');
    this.service.getTokens().subscribe((response: any) => {
      console.log (response);
    }, error => {
      console.log (error);
    });
  }

  onSubmit(): void {
    const actionPayload = {
      authToken: this.authToken,
      repeaterId: this.repeaterId
    };
    this.router.navigateByUrl('diagnostics');
    this.service.saveTokens(actionPayload).subscribe((response: any) => {
      console.log (response);
    }, error => {
      console.log (error);
    });
  }

  onIconClick(inputId, spanId): void {
    const toggleEye = document.querySelector(`#${spanId}`);
    const inputField = document.querySelector(`#${inputId}`);

    const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
    inputField.setAttribute('type', type);
    toggleEye.classList.toggle('fa-eye-slash');
  }
}

