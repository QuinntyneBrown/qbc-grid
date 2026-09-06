import { bootstrapApplication } from '@angular/platform-browser';

import { DevApp } from './app/dev-app';

bootstrapApplication(DevApp).catch((error: unknown) => console.error(error));
