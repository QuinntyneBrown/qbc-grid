/**
 * The two gestures. They differ in how the candidate cell is derived and in whether the
 * origin corner is pinned, and in nothing else, which is why one session runs both.
 */
export type GridInteractionKind = 'move' | 'resize';
