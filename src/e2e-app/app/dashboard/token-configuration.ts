/**
 * The three token configurations, keyed by the route that opens them.
 *
 * The catalogue loaded is the reference render. Absent, the grid falls back to the literals
 * in its own stylesheet, and `L2-034` asks that the two agree. Overridden, every token
 * holds a value distinct from its default, so a value that fails to move is a literal
 * hiding in the component styles.
 */
export const TOKEN_STYLESHEETS: Record<string, readonly string[]> = {
  '': ['qbc-tokens.css'],
  '/tokens/absent': [],
  '/tokens/overridden': ['qbc-tokens.css', 'tokens-overridden.css'],
};
