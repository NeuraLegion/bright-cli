import { VisibilityToggle } from '../../shared/VisibilityToggle';
import {
  RepeaterIdValidationRegExp,
  AuthTokenValidationRegExp
} from '../../../../../src/ConnectivityWizard/Entities/Tokens';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { Tokens } from 'src/app/app.model';
import { AppService } from 'src/app/app.service';
import { Subject } from 'rxjs/internal/Subject';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainComponent implements OnInit {
  public visibilityToggle = new VisibilityToggle();
  public mainForm: FormGroup;
  // private UUID_V4 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  private readonly gc = new Subject<void>();

  constructor(
    private readonly router: Router,
    private formBuilder: FormBuilder,
    private readonly service: AppService,
    private cdr: ChangeDetectorRef
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
    this.service
      .getTokens()
      .pipe(takeUntil(this.gc))
      .subscribe(
        (response: Tokens) => {
          this.visibilityToggle.initialState(response);
          this.authToken.setValue(response.authToken);
          this.repeaterId.setValue(response.repeaterId);
          this.cdr.detectChanges();
        },
        (error) => {
          console.log(error);
        }
      );
  }

  ngOnDestroy(): void {
    this.gc.next();
    this.gc.unsubscribe();
  }

  initForm(): void {
    this.mainForm = this.formBuilder.group({
      authToken: [
        '',
        [Validators.required, Validators.pattern(AuthTokenValidationRegExp)]
      ],
      repeaterId: [
        '',
        [Validators.required, Validators.pattern(RepeaterIdValidationRegExp)]
      ]
    });
  }

  onSubmit(): void {
    if (!this.mainForm.valid) {
      console.log('Error, tokens are invalid');
    } else {
      this.service
        .saveTokens(this.mainForm.value)
        .pipe(takeUntil(this.gc))
        .subscribe(
          () => {
            this.router.navigateByUrl('diagnostics');
          },
          (error) => {
            console.log(error);
          }
        );
    }
  }
}
