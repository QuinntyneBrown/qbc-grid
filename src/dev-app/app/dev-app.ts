import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { GridComponent, GridTile, GridTileTemplateDirective } from 'qbc-grid';

/** A harness for working on the library by hand. No acceptance test drives it. */
@Component({
  selector: 'dev-root',
  imports: [GridComponent, GridTileTemplateDirective],
  templateUrl: './dev-app.html',
  styleUrl: './dev-app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevApp {
  readonly layout = signal<readonly GridTile[]>([
    { id: 'alpha', x: 0, y: 0, cols: 4, rows: 2, label: 'Alpha' },
    { id: 'bravo', x: 4, y: 0, cols: 4, rows: 2, label: 'Bravo' },
  ]);
}
