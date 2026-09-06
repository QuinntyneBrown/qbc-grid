import { Routes } from '@angular/router';

import { DashboardPage } from './dashboard/dashboard';

/**
 * The dashboard, opened three ways. An unknown route has no wildcard to fall back to,
 * so a specification that mistypes one fails rather than quietly rendering the default.
 */
export const routes: Routes = [
  { path: '', component: DashboardPage },
  { path: 'tokens/absent', component: DashboardPage },
  { path: 'tokens/overridden', component: DashboardPage },
];
