import { Directive, TemplateRef, inject } from '@angular/core';

import { GridTileContext } from './grid-tile-context';

/**
 * Marks the template a grid instantiates once per tile. The tile record reaches the
 * template as the implicit context value.
 */
@Directive({
  selector: '[qbcGridTile]',
})
export class GridTileTemplateDirective {
  readonly templateRef = inject<TemplateRef<GridTileContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: GridTileTemplateDirective,
    _context: unknown,
  ): _context is GridTileContext {
    return true;
  }
}
