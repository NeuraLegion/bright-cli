import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Tokens } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';
import { VisibilityToggle } from '../../shared/VisibilityToggle';

export enum FormFields {
  AUTH_TOKEN = 'authToken',
  REPEATER_ID = 'repeaterId'
}

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  visibilityToggle = new VisibilityToggle();
  title = 'Connectivity Wizard';
  mainForm: FormGroup;

  constructor(private router: Router,
              private formBuilder: FormBuilder,
              protected service: AppService) {}

  ngOnInit() {
    console.log('Welcome');
    this.initForm();
    this.service.getTokens().subscribe((response: Tokens) => {
      if (response.authToken !== '' && response.repeaterId !== '') {
        this.visibilityToggle.toggleEye('token', 'toggleEye-1');
        this.visibilityToggle.toggleEye('repeater', 'toggleEye-2');
      }
      this.mainForm.controls[FormFields.AUTH_TOKEN].setValue(response.authToken);
      this.mainForm.controls[FormFields.REPEATER_ID].setValue(response.repeaterId);
    }, error => {
      console.log (error);
    });
  }

  initForm(): void{
    this.mainForm = this.formBuilder.group({
      authToken: ['', [Validators.required]],
      repeaterId: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.mainForm.controls[FormFields.AUTH_TOKEN].value === null || this.mainForm.controls[FormFields.REPEATER_ID].value == null) {
      console.log ('Error, tokens are invalid');
    } else {
      const actionPayload = {
        authToken: this.mainForm.controls[FormFields.AUTH_TOKEN].value,
        repeaterId: this.mainForm.controls[FormFields.REPEATER_ID].value
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

