import { describe, expect, it } from 'vitest';

import { GridTile } from './grid-tile';
import { gridKeyboardCandidate } from './grid-keyboard-candidate';

const tile = (over: Partial<GridTile> = {}): GridTile => ({
  id: 'rover',
  x: 0,
  y: 0,
  cols: 1,
  rows: 1,
  ...over,
});

const press = (key: string, modifiers: Partial<KeyboardEventInit> = {}) =>
  ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...modifiers }) as KeyboardEvent;

describe('gridKeyboardCandidate', () => {
  it('leaves a key it does not consume alone', () => {
    expect(gridKeyboardCandidate(press('Tab'), tile(), [], 12)).toBeNull();
    expect(gridKeyboardCandidate(press('a'), tile(), [], 12)).toBeNull();
  });

  it('leaves an arrow carrying Alt or Meta to the browser', () => {
    expect(gridKeyboardCandidate(press('ArrowRight', { altKey: true }), tile(), [], 12)).toBeNull();
    expect(gridKeyboardCandidate(press('ArrowRight', { metaKey: true }), tile(), [], 12)).toBeNull();
  });

  it('moves one cell for an unmodified arrow', () => {
    const subject = tile({ x: 3, y: 1 });
    expect(gridKeyboardCandidate(press('ArrowRight'), subject, [subject], 12)?.cell).toMatchObject({
      x: 4,
      y: 1,
    });
    expect(gridKeyboardCandidate(press('ArrowUp'), subject, [subject], 12)?.cell).toMatchObject({
      y: 0,
    });
  });

  it('changes the span for Shift with an arrow', () => {
    const subject = tile({ cols: 2, rows: 2 });
    const wider = gridKeyboardCandidate(press('ArrowRight', { shiftKey: true }), subject, [], 12);
    expect(wider).toMatchObject({ kind: 'resize' });
    expect(wider?.cell).toMatchObject({ cols: 3, rows: 2 });
  });

  it('holds a resize at a declared limit rather than passing it', () => {
    const subject = tile({ cols: 2, rows: 2, minCols: 2 });
    const narrower = gridKeyboardCandidate(press('ArrowLeft', { shiftKey: true }), subject, [], 12);
    expect(narrower?.cell).toMatchObject({ cols: 2 });
  });

  it('never moves the origin during a resize', () => {
    const subject = tile({ x: 9, cols: 3, rows: 1 });
    const grown = gridKeyboardCandidate(press('ArrowRight', { shiftKey: true }), subject, [], 12);
    expect(grown?.cell).toMatchObject({ x: 9, cols: 3 });
  });

  describe('Control with an arrow reaches past an obstruction', () => {
    // A one-by-one tile at the origin, with a locked full-width row beneath it.
    const rover = tile();
    const barrier = tile({ id: 'barrier', x: 0, y: 1, cols: 12, rows: 1, locked: true });
    const tiles = [rover, barrier];

    it('crosses the row a one-cell step cannot', () => {
      const jumped = gridKeyboardCandidate(press('ArrowDown', { ctrlKey: true }), rover, tiles, 12);
      expect(jumped?.cell).toMatchObject({ x: 0, y: 2 });
    });

    it('moves one cell when the neighbour is already free', () => {
      const alone = [rover];
      const jumped = gridKeyboardCandidate(press('ArrowDown', { ctrlKey: true }), rover, alone, 12);
      expect(jumped?.cell).toMatchObject({ y: 1 });
    });

    it('proposes no change when the direction leaves the grid', () => {
      const jumped = gridKeyboardCandidate(press('ArrowLeft', { ctrlKey: true }), rover, tiles, 12);
      expect(jumped?.cell).toMatchObject({ x: 0, y: 0 });
    });

    it('reaches across a horizontal obstruction', () => {
      const blocker = tile({ id: 'blocker', x: 1, y: 0, cols: 4, rows: 1 });
      const jumped = gridKeyboardCandidate(
        press('ArrowRight', { ctrlKey: true }),
        rover,
        [rover, blocker],
        12,
      );
      expect(jumped?.cell).toMatchObject({ x: 5, y: 0 });
    });

    it('clears a blocker of a billion rows without walking them', () => {
      const huge = tile({ id: 'huge', x: 0, y: 1, cols: 12, rows: 1_000_000_000 });
      const started = Date.now();
      const jumped = gridKeyboardCandidate(
        press('ArrowDown', { ctrlKey: true }),
        rover,
        [rover, huge],
        12,
      );
      expect(jumped?.cell.y).toBe(1_000_000_001);
      expect(Date.now() - started).toBeLessThan(500);
    });
  });
});
