import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GridComponent, GridMode, GridTile, GridTileTemplateDirective } from 'qbc-grid';

import { DASHBOARD_SERVICE } from './dashboard-service.token';

/**
 * A URL parameter arrives as text and the grid's input takes a number, so the page
 * converts and does nothing else. `Number` is the right conversion precisely because it
 * keeps what the criteria depend on: `7.6` stays fractional, `-4` stays negative, and
 * anything unparseable becomes `NaN` rather than something tidier. A page that repaired a
 * bad value before the grid saw it would leave those criteria testing the page.
 */
function numberParam(params: URLSearchParams, name: string): number {
  const raw = params.get(name);
  return raw === null ? Number.NaN : Number(raw);
}

/** The one screen the acceptance suite drives. */
@Component({
  selector: 'app-dashboard',
  imports: [GridComponent, GridTileTemplateDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly service = inject(DASHBOARD_SERVICE);
  private readonly params = new URLSearchParams(location.search);

  readonly layout = this.service.load();
  readonly mode = signal<GridMode>('live');

  toggleMode(): void {
    this.mode.update((mode) => (mode === 'edit' ? 'live' : 'edit'));
  }

  /**
   * A lock is a property of a tile, so the page changes the record it holds and hands the
   * grid a new layout. `L2-008` asks what happens when a tile is unlocked while the grid is
   * in edit mode, which is a transition rather than a state.
   */
  toggleLock(id: string): void {
    this.service.save(
      this.layout().map((tile) =>
        tile.id === id ? { ...tile, locked: tile.locked !== true } : tile,
      ),
    );
  }

  readonly columns = numberParam(this.params, 'columns');
  readonly rowHeight = numberParam(this.params, 'rowHeight');
  readonly gap = numberParam(this.params, 'gap');

  /**
   * An Angular output leaves no trace in the DOM, and a quarter of the specification asks
   * what the grid emitted. The record lives here rather than in the library because a
   * published grid has no business carrying instrumentation for its own tests.
   */
  readonly emissions = signal(0);
  readonly lastLayout = signal('');

  private received: readonly GridTile[] = [];

  onLayoutChange(layout: readonly GridTile[]): void {
    this.received = layout;
    this.emissions.update((count) => count + 1);
    this.lastLayout.set(JSON.stringify(layout));
    this.service.save(layout);
  }

  /**
   * `L2-023` asks that a host mutating a record it received leave the grid unaffected,
   * which needs a host willing to try. The page performs the abuse rather than the
   * specification assuming nobody will.
   */
  mutateLastLayout(): void {
    const records = this.received as GridTile[];
    records.push({ id: 'intruder', x: 0, y: 0, cols: 12, rows: 12 });
    for (const record of records) {
      record.x = 99;
      record.cols = 99;
    }
  }
}
