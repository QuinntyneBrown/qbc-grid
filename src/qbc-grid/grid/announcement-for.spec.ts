import { describe, expect, it } from 'vitest';

import { GridTile } from './grid-tile';
import { accessibleNameOf } from './accessible-name-of';
import { announcementFor } from './announcement-for';

const cell = { x: 4, y: 1, cols: 4, rows: 3 };

describe('accessibleNameOf', () => {
  it('reads the label a host supplied', () => {
    expect(accessibleNameOf({ id: 'a', x: 0, y: 0, cols: 1, rows: 1, label: 'Attitude' })).toBe(
      'Attitude',
    );
  });

  it('falls back to the id when no label was supplied', () => {
    expect(accessibleNameOf({ id: 'attitude', x: 0, y: 0, cols: 1, rows: 1 })).toBe('attitude');
  });

  it('treats a label of spaces as no label at all', () => {
    const blank: GridTile = { id: 'attitude', x: 0, y: 0, cols: 1, rows: 1, label: '   ' };
    expect(accessibleNameOf(blank)).toBe('attitude');
  });
});

describe('announcementFor', () => {
  it('names a committed move in one-based terms', () => {
    expect(announcementFor('Attitude', 'move', cell, 'accepted')).toBe(
      'Attitude at column 5, row 2.',
    );
  });

  it('names the span for a committed resize', () => {
    expect(announcementFor('Attitude', 'resize', cell, 'accepted')).toBe('Attitude sized 4 by 3.');
  });

  it('names the resting position together with the refusal that ended the run', () => {
    const blocked = announcementFor('Attitude', 'move', cell, 'blocked-occupied');
    expect(blocked).toContain('column 5, row 2');
    expect(blocked).toContain('blocked');
  });

  it('distinguishes the reasons a command can be refused', () => {
    const reasons = (['blocked-occupied', 'blocked-bounds', 'blocked-limit'] as const).map(
      (outcome) => announcementFor('Attitude', 'move', cell, outcome),
    );
    expect(new Set(reasons).size).toBe(3);
  });
});
