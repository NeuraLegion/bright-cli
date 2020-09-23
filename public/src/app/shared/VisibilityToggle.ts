export enum Type {
    PWD = 'password',
    TEXT = 'text',
}

export class VisibilityToggle{
    
    public toggleEye(inputId: string, spanId: string): void {
        const toggleEye = document.querySelector(`#${spanId}`);
        const inputField = document.querySelector(`#${inputId}`);

        const type = inputField.getAttribute('type') === Type.PWD ? Type.TEXT : Type.PWD;
        inputField.setAttribute('type', type);
        toggleEye.classList.toggle('fa-eye-slash');
    }
}
