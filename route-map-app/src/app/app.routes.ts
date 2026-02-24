import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/map/map.page').then(m => m.MapPage)
  }
];
