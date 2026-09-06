import { Signal } from '@angular/core';
import { GridTile } from 'qbc-grid';

/**
 * The contract the dashboard reaches its stored layout through. Storage access and
 * the conversion to a signal stay inside the implementations.
 */
export interface IDashboardService {
  load(): Signal<readonly GridTile[]>;
  save(layout: readonly GridTile[]): void;
}
