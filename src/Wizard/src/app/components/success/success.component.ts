import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.scss']
})
export class SuccessComponent {

  scanId: string = 'A123B456';

  constructor(private router: Router) {}

  finish(): void {}

  prev(): void {
    this.router.navigateByUrl('scan');
  }

}
