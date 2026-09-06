import { Injectable, Signal, signal } from '@angular/core';
import { GridTile } from 'qbc-grid';

import { IDashboardService } from './i-dashboard-service';
import { layoutFixtures } from './layout-fixtures';

/**
 * Resolves the layout named by the `fixture` URL parameter, so a specification reaches
 * its own precondition without touching real storage.
 */
@Injectable()
export class MockDashboardService implements IDashboardService {
  private readonly layout = signal<readonly GridTile[]>(this.read());

  load(): Signal<readonly GridTile[]> {
    return this.layout.asReadonly();
  }

  save(layout: readonly GridTile[]): void {
    this.layout.set(layout);
  }

  private read(): readonly GridTile[] {
    const name = new URLSearchParams(location.search).get('fixture');
    if (name === null) {
      return layoutFixtures['three'] as readonly GridTile[];
    }
    if (!Object.hasOwn(layoutFixtures, name)) {
      throw new Error(`Unknown layout fixture: ${name}`);
    }
    return layoutFixtures[name] as readonly GridTile[];
  }
}
