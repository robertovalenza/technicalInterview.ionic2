import {
  Component,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonItem, IonLabel, IonIcon, IonBadge, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timeOutline, navigateOutline, carOutline } from 'ionicons/icons';
import { Route } from '../../services/directions.service';

@Component({
  selector: 'app-route-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonSpinner
  ],
  templateUrl: './route-panel.component.html',
  styleUrls: ['./route-panel.component.scss']
})
export class RoutePanelComponent {
  readonly routes = input<Route[]>([]);
  readonly selectedRouteIndex = input<number>(0);
  readonly isLoading = input<boolean>(false);
  readonly routeSelected = output<number>();

  constructor() {
    addIcons({ timeOutline, navigateOutline, carOutline });
  }

  onRouteSelect(index: number): void {
    if (index !== this.selectedRouteIndex()) {
      this.routeSelected.emit(index);
    }
  }

  getRouteLabel(index: number): string {
    if (index === 0) return 'Best Route';
    if (index === 1) return 'Alternative 1';
    return `Alternative ${index}`;
  }
}
