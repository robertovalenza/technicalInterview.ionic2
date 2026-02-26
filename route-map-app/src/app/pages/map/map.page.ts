import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonIcon,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locationOutline, navigate } from 'ionicons/icons';
import { Position } from '@capacitor/geolocation';

import { MapViewerComponent } from '../../components/map-viewer/map-viewer.component';
import { LocationSearchComponent } from '../../components/location-search/location-search.component';
import { RoutePanelComponent } from '../../components/route-panel/route-panel.component';

import {
  GeolocationService,
  GeolocationError,
} from '../../services/geolocation.service';
import { PlaceResult } from '../../services/places.service';
import { DirectionsService, Route } from '../../services/directions.service';
import { MapConfigService } from '../../services/map-config.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    MapViewerComponent,
    LocationSearchComponent,
    RoutePanelComponent,
  ],
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
})
export class MapPage implements OnInit, OnDestroy {
  private geolocationService = inject(GeolocationService);
  private directionsService = inject(DirectionsService);
  private mapConfigService = inject(MapConfigService);
  private alertController = inject(AlertController);

  // Use geolocation service signals directly - NO SYNCING
  readonly currentPosition = this.geolocationService.currentPosition;
  readonly locationError = this.geolocationService.locationError;
  readonly isLocating = this.geolocationService.isLocating;

  readonly selectedDestination = signal<PlaceResult | null>(null);
  readonly routes = signal<Route[]>([]);
  readonly selectedRouteIndex = signal<number>(0);
  readonly isCalculatingRoute = signal<boolean>(false);
  // GPS position as default - starts null, waits for GPS
  readonly mapCenter = signal<google.maps.LatLngLiteral | null>(null);
  readonly showLocationBanner = computed(() => {
    return this.locationError()?.code === 'PERMISSION_DENIED';
  });
  readonly deviceHeading = signal<number | null>(null);
  private headingListener: any = null;

  readonly originLocation = computed(() => {
    const position = this.currentPosition();
    if (!position) return null;
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  });

  readonly destinationLocation = computed(() => {
    const destination = this.selectedDestination();
    if (!destination) return null;
    return destination.location;
  });

  readonly routePaths = computed(() => {
    return this.routes().map((route) => route.path);
  });

  readonly hasLocationPermission = computed(() => {
    return this.geolocationService.hasPermission();
  });

  constructor() {
    addIcons({ locationOutline, navigate });

    // Effect to update mapCenter when position is obtained
    effect(
      () => {
        const position = this.currentPosition();
        if (position) {
          this.mapCenter.set({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      },
      { allowSignalWrites: true },
    );

    // Effect to fallback to default center if GPS fails
    effect(
      () => {
        const error = this.locationError();
        // Use untracked to avoid circular dependency
        const center = untracked(this.mapCenter);
        if (error && !center) {
          this.mapCenter.set(this.mapConfigService.getDefaultCenter());
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const destination = this.selectedDestination();
        const origin = this.originLocation();
        if (origin && destination) {
          this.calculateRoutes(origin, destination.location);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const destination = this.selectedDestination();
        if (destination) {
          this.mapCenter.set(destination.location);
        }
      },
      { allowSignalWrites: true },
    );
  }

  async ngOnInit(): Promise<void> {
    await this.initializeLocation();
    this.startHeadingListener();
  }

  ngOnDestroy(): void {
    this.stopHeadingListener();
  }

  private startHeadingListener(): void {
    if (window.DeviceOrientationEvent) {
      this.headingListener = (event: DeviceOrientationEvent) => {
        let heading = event.alpha || 0;

        if ((event as any).webkitCompassHeading) {
          heading = (event as any).webkitCompassHeading;
        } else if (event.alpha !== null) {
          heading = 360 - event.alpha;
        }

        heading = (heading + 360) % 360;

        this.deviceHeading.set(heading);
      };

      window.addEventListener('deviceorientation', this.headingListener);
    }
  }

  private stopHeadingListener(): void {
    if (this.headingListener) {
      window.removeEventListener('deviceorientation', this.headingListener);
      this.headingListener = null;
    }
  }

  private async initializeLocation(): Promise<void> {
    await this.geolocationService.checkPermissions();

    if (!this.geolocationService.hasPermission()) {
      const granted = await this.geolocationService.requestPermissions();
      if (!granted) {
        this.showLocationError({
          code: 'PERMISSION_DENIED',
          message:
            'Accesso alla posizione richiesto per il percorso. Abilita nelle impostazioni.',
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
    destination: google.maps.LatLngLiteral,
  ): Promise<void> {
    this.isCalculatingRoute.set(true);
    this.selectedRouteIndex.set(0);

    try {
      const result = await this.directionsService.calculateRoute(
        origin,
        destination,
      );
      this.routes.set(result.routes);
    } catch (error: any) {
      this.routes.set([]);
      const errorMessage = error?.message || 'Impossibile calcolare il percorso. Riprova più tardi.';
      this.showRouteError(errorMessage);
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
    console.warn('Search error:', errorMessage);
  }

  onRouteSelected(index: number): void {
    this.selectedRouteIndex.set(index);
  }

  onPanelClosed(): void {
    this.routes.set([]);
    this.selectedDestination.set(null);
    this.selectedRouteIndex.set(0);
  }

  async recenterOnCurrentLocation(): Promise<void> {
    const position = await this.geolocationService.getCurrentPosition();
    if (position) {
      this.mapCenter.set({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } else {
      const error = this.geolocationService.locationError();
      if (error) {
        this.showLocationError(error);
      }
    }
  }

  async useCurrentLocationAsDestination(): Promise<void> {
    const position = await this.geolocationService.getCurrentPosition();
    if (position) {
      const currentLocation: PlaceResult = {
        placeId: 'current-location',
        name: 'La Mia Posizione',
        formattedAddress: 'Posizione GPS Attuale',
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
      };
      this.selectedDestination.set(currentLocation);
    } else {
      const error = this.geolocationService.locationError();
      if (error) {
        this.showLocationError(error);
      }
    }
  }

  private async showLocationError(error: GeolocationError): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Errore Posizione',
      message: error.message,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await alert.present();
  }

  private async showRouteError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Errore Percorso',
      message: message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
