import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR
} from '@angular/forms';
import { DOCUMENT } from '@angular/common';

type Type = 'text' | 'password';

type Autocomplete = 'off' | 'on';

@Component({
  selector: 'secret-field',
  templateUrl: 'secret-field.component.html',
  styleUrls: ['secret-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      useExisting: SecretFieldComponent,
      multi: true
    }
  ]
})
export class SecretFieldComponent implements ControlValueAccessor {
  public hidden = true;
  public onChange: (value: string) => void;
  public onTouched: () => void;
  public readonly formControl = new FormControl('');

  get value(): string {
    return this.formControl.value;
  }

  set value(value: string | null) {
    this.formControl.patchValue(value ?? '');
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _placeholder: string;

  @Input()
  get placeholder(): string {
    // eslint-disable-next-line no-underscore-dangle
    return this._placeholder;
  }

  set placeholder(plh: string) {
    // eslint-disable-next-line no-underscore-dangle
    this._placeholder = plh;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _required = false;

  @Input()
  get required(): boolean {
    // eslint-disable-next-line no-underscore-dangle
    return this._required;
  }

  set required(req: boolean) {
    // eslint-disable-next-line no-underscore-dangle
    this._required = !!req;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _disabled = false;

  @Input()
  get disabled(): boolean {
    // eslint-disable-next-line no-underscore-dangle
    return this._disabled;
  }

  set disabled(value: boolean) {
    // eslint-disable-next-line no-underscore-dangle
    this._disabled = !!value;
    if (value) {
      this.formControl.disable();
    } else {
      this.formControl.enable();
    }
  }

  get empty(): boolean {
    return !this.formControl.value;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _autocomplete: Autocomplete = 'off';

  get autocomplete(): Autocomplete {
    // eslint-disable-next-line no-underscore-dangle
    return this._autocomplete;
  }

  @Input()
  set autocomplete(value: Autocomplete) {
    if (['off', 'on'].includes(value)) {
      // eslint-disable-next-line no-underscore-dangle
      this._autocomplete = value;
    }
  }

  get type(): Type {
    return this.hidden ? 'password' : 'text';
  }

  constructor(
    private readonly elRef: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  public handleInput(): void {
    this.onChange(this.value);
  }

  public setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public writeValue(value: string): void {
    this.value = value;
  }

  public toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.hidden = !this.hidden;
  }
}
