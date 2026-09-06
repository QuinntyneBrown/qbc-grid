import { chromium, type FullConfig } from '@playwright/test';

/**
 * Opens each route once before the suite runs.
 *
 * The development server answers the first request long before it has compiled the route
 * that request asked for, so the workers that arrive together at the start of a run all
 * wait on the same compilation — and the first action any of them takes can exceed its
 * timeout. Warming the routes once costs a few seconds and removes a class of failure that
 * has nothing to do with the grid.
 */
export default async function warmUp(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (baseURL === undefined) return;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const route of ['/', '/tokens/absent', '/tokens/overridden']) {
    await page.goto(new URL(route, baseURL).href, { waitUntil: 'networkidle' });
    await page.locator('[data-qbc-grid]').first().waitFor({ state: 'attached' });
  }
  await browser.close();
}
