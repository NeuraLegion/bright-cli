import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Tokens } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';
import { VisibilityToggle } from '../../shared/VisibilityToggle';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  visibilityToggle = new VisibilityToggle();
  title = 'Connectivity Wizard';
  authToken: string;
  repeaterId: string;

  constructor(private router: Router,
              protected service: AppService) {}

  ngOnInit() {
    console.log('Welcome');
    this.service.getTokens().subscribe((response: Tokens) => {
      if (response.authToken !== '' && response.repeaterId !== '') {
        this.visibilityToggle.toggleEye('token', 'toggleEye-1');
        this.visibilityToggle.toggleEye('repeater', 'toggleEye-2');
      }
      this.authToken = response.authToken;
      this.repeaterId = response.repeaterId;
    }, error => {
      console.log (error);
    });
  }

  onSubmit(): void {
    if (this.authToken === null || this.repeaterId == null) {
      console.log ('Error, tokens are invalid');
    } else {
      const actionPayload = {
        authToken: this.authToken,
        repeaterId: this.repeaterId
      };
      this.service.saveTokens(actionPayload).subscribe((response: any) => {
        this.router.navigateByUrl('diagnostics');
      }, error => {
        console.log (error);
      });
    }
  }

  onIconClick(inputId, spanId): void {
    this.visibilityToggle.toggleEye(inputId, spanId);
  }
}

