import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locateOutline, locationOutline } from 'ionicons/icons';

import { MapViewerComponent } from '../../components/map-viewer/map-viewer.component';
import { LocationSearchComponent } from '../../components/location-search/location-search.component';
import { RoutePanelComponent } from '../../components/route-panel/route-panel.component';

import { GeolocationService, GeolocationError } from '../../services/geolocation.service';
import { PlacesService, PlaceResult } from '../../services/places.service';
import { DirectionsService, Route } from '../../services/directions.service';
import { MapConfigService } from '../../services/map-config.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    MapViewerComponent,
    LocationSearchComponent,
    RoutePanelComponent
  ],
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss']
})
export class MapPage implements OnInit, OnDestroy {
  private geolocationService = inject(GeolocationService);
  private directionsService = inject(DirectionsService);
  private mapConfigService = inject(MapConfigService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  readonly currentPosition = signal<GeolocationPosition | null>(null);
  readonly locationError = signal<GeolocationError | null>(null);
  readonly isLocating = signal<boolean>(false);
  readonly selectedDestination = signal<PlaceResult | null>(null);
  readonly routes = signal<Route[]>([]);
  readonly selectedRouteIndex = signal<number>(0);
  readonly isCalculatingRoute = signal<boolean>(false);
  readonly showLocationBanner = signal<boolean>(false);
  readonly mapCenter = signal<google.maps.LatLngLiteral>(
    this.mapConfigService.getDefaultCenter()
  );

  readonly originLocation = computed(() => {
    const position = this.currentPosition();
    if (!position) return null;
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
  });

  readonly destinationLocation = computed(() => {
    const destination = this.selectedDestination();
    if (!destination) return null;
    return destination.location;
  });

  readonly routePaths = computed(() => {
    return this.routes().map(route => route.path);
  });

  readonly hasLocationPermission = computed(() => {
    return this.geolocationService.hasPermission();
  });

  constructor() {
    addIcons({ locateOutline, locationOutline });

    effect(() => {
      this.currentPosition.set(this.geolocationService.currentPosition());
      this.locationError.set(this.geolocationService.locationError());
      this.isLocating.set(this.geolocationService.isLocating());
    });

    effect(() => {
      const error = this.locationError();
      this.showLocationBanner.set(error?.code === 'PERMISSION_DENIED');
    });

    effect(() => {
      const position = this.currentPosition();
      if (position) {
        this.mapCenter.set({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      }
    });

    effect(() => {
      const destination = this.selectedDestination();
      const origin = this.originLocation();
      if (origin && destination) {
        this.calculateRoutes(origin, destination);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.initializeLocation();
  }

  ngOnDestroy(): void {}

  private async initializeLocation(): Promise<void> {
    await this.geolocationService.checkPermissions();

    if (!this.geolocationService.hasPermission()) {
      const granted = await this.geolocationService.requestPermissions();
      if (!granted) {
        this.showLocationError({
          code: 'PERMISSION_DENIED',
          message: 'Location access is required for routing. Please enable in settings.'
        });
        return;
      }
    }

    const position = await this.geolocationService.getCurrentPosition();
    if (!position) {
      const error = this.geolocationService.locationError();
      if (error) {
        this.showLocationError(error);
      }
    }
  }

  private async calculateRoutes(
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral
  ): Promise<void> {
    this.isCalculatingRoute.set(true);
    this.selectedRouteIndex.set(0);

    await this.showToast('Calculating routes...');

    try {
      const result = await this.directionsService.calculateRoute(origin, destination);
      this.routes.set(result.routes);
      if (result.routes.length > 0) {
        await this.showToast('Routes updated');
      }
    } catch (error: any) {
      this.routes.set([]);
      await this.showRouteError(error.message || 'Failed to calculate routes');
    } finally {
      this.isCalculatingRoute.set(false);
    }
  }

  onDestinationSelected(destination: PlaceResult): void {
    this.selectedDestination.set(destination);
  }

  onSearchCleared(): void {
    this.selectedDestination.set(null);
    this.routes.set([]);
    this.selectedRouteIndex.set(0);
  }

  onSearchError(errorMessage: string): void {
    this.showRouteError(errorMessage);
  }

  onRouteSelected(index: number): void {
    this.selectedRouteIndex.set(index);
  }

  async recenterOnCurrentLocation(): Promise<void> {
    const position = await this.geolocationService.getCurrentPosition();
    if (position) {
      this.mapCenter.set({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    } else {
      const error = this.geolocationService.locationError();
      if (error) {
        this.showLocationError(error);
      }
    }
  }

  private async showLocationError(error: GeolocationError): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Location Error',
      message: error.message,
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await alert.present();
  }

  private async showRouteError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Route Error',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
