/**
 * The two states a grid can be in. `live` is inert: it presents no affordance and
 * refuses every gesture. `edit` allows an unlocked tile to be moved and resized.
 */
export type GridMode = 'live' | 'edit';
