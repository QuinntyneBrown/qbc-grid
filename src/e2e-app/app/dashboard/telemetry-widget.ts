import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GridTile } from 'qbc-grid';

/** Counts constructions, so a re-created widget can be told from a moved one. */
let constructed = 0;

/**
 * A widget projected into a tile, carrying the three kinds of state a move could destroy:
 * the instance itself, a scroll position the browser owns, and the value and focus of a
 * field the operator is using.
 *
 * The instance counter alone is not enough to answer the requirement. An Angular view can
 * be moved intact while the browser resets what it holds, so a criterion counting
 * constructor calls reports success in exactly the cases that matter.
 */
@Component({
  selector: 'app-telemetry-widget',
  templateUrl: './telemetry-widget.html',
  styleUrl: './telemetry-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelemetryWidget {
  readonly tile = input.required<GridTile>();

  readonly instance = (constructed += 1);

  /** Lines to scroll through, so a scroll position exists to survive. */
  readonly lines = Array.from({ length: 40 }, (_, index) => `Reading ${index + 1}`);
}
