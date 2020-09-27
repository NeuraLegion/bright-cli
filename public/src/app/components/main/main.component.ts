import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  mainForm: FormGroup;

  constructor(private readonly router: Router,
              private formBuilder: FormBuilder,
              private readonly service: AppService) {}

  get repeaterId(): AbstractControl {
    return this.mainForm.get('repeaterId');
  }

  get authToken(): AbstractControl {
    return this.mainForm.get('authToken');
  }

  ngOnInit(): void{
    console.log('Welcome');
    this.initForm();
    this.service.getTokens().subscribe((response: Tokens) => {
      if (response.authToken !== '' && response.repeaterId !== '') {
        this.visibilityToggle.toggleEye('token', 'toggleEye-1');
        this.visibilityToggle.toggleEye('repeater', 'toggleEye-2');
      }
      this.authToken.setValue(response.authToken);
      this.repeaterId.setValue(response.repeaterId);
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
    if (this.authToken.value === null || this.repeaterId.value == null) {
      console.log ('Error, tokens are invalid');
    } else {
      const actionPayload: Tokens = {
        authToken: this.authToken.value,
        repeaterId: this.repeaterId.value
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
