import { InjectionToken } from '@angular/core';

import { IDashboardService } from './i-dashboard-service';

/** The token every consumer of the dashboard's layout store injects. */
export const DASHBOARD_SERVICE = new InjectionToken<IDashboardService>('DASHBOARD_SERVICE');
