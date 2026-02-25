import { Component, input, output, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonItem, IonIcon, IonBadge, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timeOutline, navigateOutline, carOutline, navigate, arrowForward, closeOutline } from 'ionicons/icons';
import { Route } from '../../services/directions.service';

@Component({
  selector: 'app-route-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardContent,
    IonItem,
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
  readonly panelClosed = output<void>();

  private readonly elementRef = inject(ElementRef);
  private touchStartY = 0;
  private readonly minSwipeDistance = 80;

  constructor() {
    addIcons({ timeOutline, navigateOutline, carOutline, navigate, arrowForward, closeOutline });
  }

  private getPanelElement(): HTMLElement | null {
    return this.elementRef.nativeElement.querySelector('.route-panel');
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].screenY;
  }

  onTouchMove(event: TouchEvent): void {
    const touchY = event.touches[0].screenY;
    const deltaY = touchY - this.touchStartY;
    const panel = this.getPanelElement();
    if (deltaY > 0 && panel) {
      event.preventDefault();
      const resistance = 0.5;
      panel.style.transform = `translateY(${deltaY * resistance}px)`;
    }
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndY = event.changedTouches[0].screenY;
    const swipeDistance = touchEndY - this.touchStartY;
    const panel = this.getPanelElement();
    if (panel) {
      panel.style.transform = '';
      if (swipeDistance > this.minSwipeDistance) {
        this.panelClosed.emit();
      }
    }
  }

  onCloseClick(): void {
    this.panelClosed.emit();
  }

  onRouteSelect(index: number): void {
    if (index !== this.selectedRouteIndex()) {
      this.routeSelected.emit(index);
    }
  }

  getRouteLabel(index: number): string {
    if (index === 0) return 'Percorso Migliore';
    if (index === 1) return 'Alternativa 1';
    return `Alternativa ${index}`;
  }
}
