import { Injectable, Signal, signal } from '@angular/core';
import { GridTile } from 'qbc-grid';

import { IDashboardService } from './i-dashboard-service';

const STORAGE_KEY = 'qbc-grid.dashboard';

/** Reads and writes the dashboard layout as JSON in browser local storage. */
@Injectable()
export class DashboardService implements IDashboardService {
  private readonly layout = signal<readonly GridTile[]>(this.read());

  load(): Signal<readonly GridTile[]> {
    return this.layout.asReadonly();
  }

  save(layout: readonly GridTile[]): void {
    this.layout.set(layout);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // A dashboard that cannot reach storage stays usable with what it holds.
    }
  }

  private read(): readonly GridTile[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? [] : (JSON.parse(stored) as readonly GridTile[]);
    } catch {
      return [];
    }
  }
}
