import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
} from '@angular/core';

import { GridMode } from './grid-mode';
import { GridTile } from './grid-tile';
import { GridTileTemplateDirective } from './grid-tile-template';

/**
 * Arranges tiles on a cell-based grid. The layout reaches the grid as plain data and
 * leaves it the same way; the grid reads no store and injects no service of its own.
 */
@Component({
  selector: 'qbc-grid',
  imports: [NgTemplateOutlet],
  templateUrl: './grid.html',
  styleUrl: './grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-qbc-grid': '',
    '[attr.data-mode]': 'mode()',
    tabindex: '-1',
  },
})
export class GridComponent {
  readonly layout = input.required<readonly GridTile[]>();
  readonly columns = input(12);
  readonly rowHeight = input(60);
  readonly gap = input(8);
  readonly mode = input<GridMode>('live');

  protected readonly tileTemplate = contentChild(GridTileTemplateDirective);

  /** The tiles the grid currently renders. */
  readonly tiles = this.layout;
}
