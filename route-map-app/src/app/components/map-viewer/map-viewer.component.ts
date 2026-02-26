import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  viewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapConfigService } from '../../services/map-config.service';
import { MarkerService } from '../../services/marker.service';
import { createGoogleMapsLoader } from '../../core/utils';

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-viewer.component.html',
  styleUrls: ['./map-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapViewerComponent implements OnInit, OnDestroy {
  readonly mapContainer = viewChild.required<ElementRef>('mapContainer');
  readonly center = input<google.maps.LatLngLiteral | null>(null);
  readonly zoom = input<number>(14);
  readonly originMarker = input<google.maps.LatLngLiteral | null>(null);
  readonly heading = input<number | null>(null);
  readonly destinationMarker = input<google.maps.LatLngLiteral | null>(null);
  readonly routes = input<google.maps.LatLngLiteral[][]>([]);
  readonly activeRouteIndex = input<number>(0);
  readonly mapReady = output<google.maps.Map>();

  private map: google.maps.Map | null = null;
  private originMarkerInstance: google.maps.Marker | null = null;
  private destinationMarkerInstance: google.maps.Marker | null = null;
  private routePolylines: google.maps.Polyline[] = [];

  private configService = inject(MapConfigService);
  private markerService = inject(MarkerService);

  constructor() {
    effect(
      () => {
        const newCenter = this.center();
        if (this.map && newCenter) {
          this.map.panTo(newCenter);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const newZoom = this.zoom();
        if (this.map) {
          this.map.setZoom(newZoom);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const origin = this.originMarker();
        this.updateOriginMarker(origin);
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const destination = this.destinationMarker();
        this.updateDestinationMarker(destination);
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const routes = this.routes();
        const activeIndex = this.activeRouteIndex();
        this.updateRoutePolylines(routes, activeIndex);
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    createGoogleMapsLoader().then(() => {
      this.initializeMap();
    });
  }

  ngOnDestroy(): void {
    // Clean up polylines
    this.routePolylines.forEach((polyline) => polyline.setMap(null));
    this.routePolylines = [];

    this.markerService.removeMarker(this.originMarkerInstance);
    this.markerService.removeMarker(this.destinationMarkerInstance);
    this.originMarkerInstance = null;
    this.destinationMarkerInstance = null;

    if (this.map) {
      google.maps.event.clearInstanceListeners(this.map);
      this.map = null;
    }
  }

  private initializeMap(): void {
    const mapElement = this.mapContainer().nativeElement;
    const config = this.configService.getConfig();

    const mapOptions: google.maps.MapOptions = {
      center: this.center() || config.defaultCenter,
      zoom: this.zoom() || config.defaultZoom,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
    };

    this.map = new google.maps.Map(mapElement, mapOptions);
    this.mapReady.emit(this.map);
  }

  private updateOriginMarker(position: google.maps.LatLngLiteral | null): void {
    if (!this.map) return;

    if (position) {
      // Create or update marker (recycles existing marker if possible)
      this.originMarkerInstance = this.markerService.createOrUpdateMarker(
        this.map,
        this.originMarkerInstance,
        position,
        this.markerService.createLocationMarkerIcon(),
        'La Tua Posizione',
      );
    } else {
      this.markerService.removeMarker(this.originMarkerInstance);
      this.originMarkerInstance = null;
    }
  }

  private updateDestinationMarker(
    position: google.maps.LatLngLiteral | null,
  ): void {
    if (!this.map) return;

    if (position) {
      // Create or update marker (recycles existing marker if possible)
      this.destinationMarkerInstance = this.markerService.createOrUpdateMarker(
        this.map,
        this.destinationMarkerInstance,
        position,
        this.markerService.createDestinationMarkerIcon(),
        'Destinazione',
      );
    } else {
      // Remove marker if no position
      this.markerService.removeMarker(this.destinationMarkerInstance);
      this.destinationMarkerInstance = null;
    }
  }

  private updateRoutePolylines(
    routes: google.maps.LatLngLiteral[][],
    activeIndex: number,
  ): void {
    if (!this.map) return;

    // Clean up existing polylines
    this.routePolylines.forEach((polyline) => polyline.setMap(null));
    this.routePolylines = [];

    if (routes.length === 0) return;

    // Create new polylines
    routes.forEach((path, index) => {
      const isActive = index === activeIndex;
      const polyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: isActive ? '#4285F4' : '#9AA0A6',
        strokeOpacity: isActive ? 1.0 : 0.6,
        strokeWeight: isActive ? 5 : 3,
        map: this.map,
      });
      this.routePolylines.push(polyline);
    });

    // Fit bounds to show all routes
    const bounds = new google.maps.LatLngBounds();
    routes.forEach((path) => {
      path.forEach((point) => bounds.extend(point));
    });
    this.map.fitBounds(bounds, 50);
  }
}
