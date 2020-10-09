import { Tokens } from '../app.model';

export enum Type {
  PWD = 'password',
  TEXT = 'text'
}

export class VisibilityToggle {
  public initialState(response: Tokens): void {
    if (response.authToken !== '' && response.repeaterId !== '') {
      this.toggleEye('token', 'toggleEye-1');
      this.toggleEye('repeater', 'toggleEye-2');
    }
  }

  public toggleEye(inputId: string, spanId: string): void {
    const toggleEye = document.querySelector(`#${spanId}`);
    const inputField = document.querySelector(`#${inputId}`);

    const type =
      inputField.getAttribute('type') === Type.PWD ? Type.TEXT : Type.PWD;
    inputField.setAttribute('type', type);
    toggleEye.classList.toggle('fa-eye-slash');
  }
}
