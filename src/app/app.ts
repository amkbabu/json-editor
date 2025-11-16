import { Component, signal } from '@angular/core';
import { JsonViewer } from './json-viewer/json-viewer';

@Component({
  selector: 'app-root',
  imports: [JsonViewer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('angular-json-viewer');
}
