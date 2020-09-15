import { Component } from '@angular/core';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss']
})

export class ScanComponent {

  targetUrl: string = '{{url}}';

  onSubmit(): void{}

}
