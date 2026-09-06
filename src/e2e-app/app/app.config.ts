import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { DASHBOARD_SERVICE } from './dashboard/dashboard-service.token';
import { DashboardService } from './dashboard/dashboard-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: DASHBOARD_SERVICE, useClass: DashboardService },
  ],
};
