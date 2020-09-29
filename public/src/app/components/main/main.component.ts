import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
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
  public visibilityToggle = new VisibilityToggle();
  public mainForm: FormGroup;
  private UUIDv4 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService
  ) {}

  get repeaterId(): AbstractControl {
    return this.mainForm.get('repeaterId');
  }

  get authToken(): AbstractControl {
    return this.mainForm.get('authToken');
  }

  ngOnInit(): void {
    console.log('Welcome to the Connectivity Wizard');
    this.initForm();
    this.service.getTokens().subscribe(
      (response: Tokens) => {
        this.visibilityToggle.initialState(response);
        this.authToken.setValue(response.authToken);
        this.repeaterId.setValue(response.repeaterId);
      },
      (error) => {
        console.log(error);
      }
    );
  }

  initForm(): void {
    this.mainForm = this.formBuilder.group({
      authToken: ['', [Validators.required]],
      repeaterId: ['', [Validators.required, Validators.pattern(this.UUIDv4)]]
    });
  }

  onSubmit(): void {
    if (!this.mainForm.valid) {
      console.log('Error, tokens are invalid');
    } else {
      const actionPayload: Tokens = {
        authToken: this.authToken.value,
        repeaterId: this.repeaterId.value
      };
      this.service.saveTokens(actionPayload).subscribe(
        (response: any) => {
          this.router.navigateByUrl('diagnostics');
        },
        (error) => {
          console.log(error);
        }
      );
    }
  }
}
