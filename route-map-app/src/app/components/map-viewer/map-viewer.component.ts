import {
  Component,
  ElementRef,
  input,
  output,
  viewChild,
  effect,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapConfigService } from '../../services/map-config.service';

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-viewer.component.html',
  styleUrls: ['./map-viewer.component.scss'],
})
export class MapViewerComponent implements OnInit {
  readonly mapContainer = viewChild.required<ElementRef>('mapContainer');
  readonly center = input<google.maps.LatLngLiteral | null>(null);
  readonly zoom = input<number>(14);
  readonly originMarker = input<google.maps.LatLngLiteral | null>(null);
  readonly heading = input<number | null>(null);
  readonly destinationMarker = input<google.maps.LatLngLiteral | null>(null);
  readonly routes = input<google.maps.LatLngLiteral[][]>([]);
  readonly activeRouteIndex = input<number>(0);
  readonly mapReady = output<google.maps.Map>();
  readonly mapClick = output<google.maps.LatLngLiteral>();

  private map: google.maps.Map | null = null;
  private originMarkerInstance: google.maps.Marker | null = null;
  private destinationMarkerInstance: google.maps.Marker | null = null;
  private routePolylines: google.maps.Polyline[] = [];

  constructor(private configService: MapConfigService) {
    effect(() => {
      const newCenter = this.center();
      if (this.map && newCenter) {
        this.map.panTo(newCenter);
      }
    });

    effect(() => {
      const newZoom = this.zoom();
      if (this.map) {
        this.map.setZoom(newZoom);
      }
    });

    effect(() => {
      const origin = this.originMarker();
      const heading = this.heading();
      this.updateOriginMarker(origin, heading ?? undefined);
    });

    effect(() => {
      const destination = this.destinationMarker();
      this.updateDestinationMarker(destination);
    });

    effect(() => {
      const routes = this.routes();
      const activeIndex = this.activeRouteIndex();
      this.updateRoutePolylines(routes, activeIndex);
    });
  }

  ngOnInit(): void {
    this.waitForGoogleMaps().then(() => {
      this.initializeMap();
    });
  }

  private waitForGoogleMaps(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof google !== 'undefined' && google.maps) {
        resolve();
        return;
      }

      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        console.error('Google Maps failed to load within 10 seconds');
        resolve();
      }, 10000);
    });
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

    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        this.mapClick.emit({
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        });
      }
    });

    this.mapReady.emit(this.map);
  }

  private createLocationMarkerSVG(heading?: number): string {
    const rotation = heading ?? 0;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
            <feOffset dx="0" dy="0" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g transform="translate(20, 20) rotate(${rotation})">
          <!-- Direction cone/shadow (blue semitransparent) -->
          <path d="M 0,-3 L 0,-12 L 5,0 L 0,-3" fill="rgba(66, 133, 244, 0.3)" stroke="none"/>
          <path d="M 0,-3 L 0,-12 L -5,0 L 0,-3" fill="rgba(66, 133, 244, 0.3)" stroke="none"/>
        </g>
        <g transform="translate(20, 20)">
          <!-- Outer white border -->
          <circle cx="0" cy="0" r="8" fill="white" filter="url(#shadow)"/>
          <!-- Blue circle -->
          <circle cx="0" cy="0" r="6" fill="#4285F4"/>
        </g>
      </svg>
    `;
  }

  private updateOriginMarker(
    position: google.maps.LatLngLiteral | null,
    heading?: number,
  ): void {
    if (!this.map) return;
    if (this.originMarkerInstance) {
      this.originMarkerInstance.setMap(null);
      this.originMarkerInstance = null;
    }
    if (position) {
      const svgString = this.createLocationMarkerSVG(heading);
      const svgUrl =
        'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString);

      this.originMarkerInstance = new google.maps.Marker({
        position: position,
        map: this.map,
        title: 'La Tua Posizione',
        icon: {
          url: svgUrl,
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20),
        },
      });
    }
  }

  private updateDestinationMarker(
    position: google.maps.LatLngLiteral | null,
  ): void {
    if (!this.map) return;
    if (this.destinationMarkerInstance) {
      this.destinationMarkerInstance.setMap(null);
      this.destinationMarkerInstance = null;
    }
    if (position) {
      this.destinationMarkerInstance = new google.maps.Marker({
        position: position,
        map: this.map,
        title: 'Destinazione',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new google.maps.Size(40, 40),
        },
      });
    }
  }

  private updateRoutePolylines(
    routes: google.maps.LatLngLiteral[][],
    activeIndex: number,
  ): void {
    if (!this.map) return;
    this.routePolylines.forEach((polyline) => polyline.setMap(null));
    this.routePolylines = [];

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

    if (routes.length > 0 && this.map) {
      const bounds = new google.maps.LatLngBounds();
      routes.forEach((path) => {
        path.forEach((point) => bounds.extend(point));
      });
      this.map.fitBounds(bounds, 50);
    }
  }

  panToCenter(center: google.maps.LatLngLiteral): void {
    if (this.map) {
      this.map.panTo(center);
    }
  }
}
