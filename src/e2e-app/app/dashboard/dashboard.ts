import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GridComponent, GridMode, GridTileTemplateDirective } from 'qbc-grid';

import { DASHBOARD_SERVICE } from './dashboard-service.token';

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

  readonly layout = this.service.load();
  readonly mode = signal<GridMode>('live');
}
