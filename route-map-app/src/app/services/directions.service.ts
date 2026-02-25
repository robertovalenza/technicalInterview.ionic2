import { Injectable } from '@angular/core';
import { MapConfigService } from './map-config.service';

export interface Route {
  index: number;
  summary: string;
  distance: string;
  duration: string;
  distanceValue: number;
  durationValue: number;
  steps: RouteStep[];
  path: google.maps.LatLngLiteral[];
  polyline: string;
}

export interface RouteStep {
  instructions: string;
  distance: string;
  duration: string;
}

export interface RouteResult {
  routes: Route[];
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
}

export interface DirectionsError {
  code: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class DirectionsService {
  private directionsService: google.maps.DirectionsService | null = null;

  constructor(private configService: MapConfigService) {}

  private initializeService(): void {
    if (!this.directionsService && google?.maps) {
      this.directionsService = new google.maps.DirectionsService();
    }
  }

  async calculateRoute(
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
  ): Promise<RouteResult> {
    this.initializeService();

    if (!this.directionsService) {
      throw new Error('Google Directions service not available');
    }

    const maxAlternatives = this.configService.getMaxRouteAlternatives();

    return new Promise((resolve, reject) => {
      this.directionsService!.route(
        {
          origin: origin,
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: maxAlternatives > 1,
          optimizeWaypoints: false,
        },
        (result, status) => {
          if (status !== google.maps.DirectionsStatus.OK || !result) {
            const error = this.parseDirectionsError(status);
            reject(error);
            return;
          }

          const routes = this.parseRoutes(result);

          resolve({
            routes,
            origin,
            destination,
          });
        },
      );
    });
  }

  private parseRoutes(result: google.maps.DirectionsResult): Route[] {
    return result.routes.map((route, index) => {
      const leg = route.legs[0];

      return {
        index,
        summary: route.summary || `Route ${index + 1}`,
        distance: leg.distance?.text || '',
        duration: leg.duration?.text || '',
        distanceValue: leg.distance?.value || 0,
        durationValue: leg.duration?.value || 0,
        steps: leg.steps.map((step) => ({
          instructions: step.instructions,
          distance: step.distance?.text || '',
          duration: step.duration?.text || '',
        })),
        path: this.decodePolyline(route.overview_polyline),
        polyline: route.overview_polyline,
      };
    });
  }

  private decodePolyline(polyline: string): google.maps.LatLngLiteral[] {
    const path: google.maps.LatLngLiteral[] = [];
    let index = 0;
    const len = polyline.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      path.push({
        lat: lat / 1e5,
        lng: lng / 1e5,
      });
    }

    return path;
  }

  private parseDirectionsError(
    status: google.maps.DirectionsStatus,
  ): DirectionsError {
    switch (status) {
      case google.maps.DirectionsStatus.ZERO_RESULTS:
        return {
          code: 'ZERO_RESULTS',
          message:
            'Nessun percorso trovato tra queste posizioni. Prova posizioni diverse.',
        };
      case google.maps.DirectionsStatus.NOT_FOUND:
        return {
          code: 'NOT_FOUND',
          message: 'Una o più posizioni non trovate. Controlla gli indirizzi.',
        };
      case google.maps.DirectionsStatus.MAX_WAYPOINTS_EXCEEDED:
        return {
          code: 'MAX_WAYPOINTS_EXCEEDED',
          message: 'Troppi punti intermedi nella richiesta.',
        };
      case google.maps.DirectionsStatus.INVALID_REQUEST:
        return {
          code: 'INVALID_REQUEST',
          message: 'Richiesta percorso non valida. Riprova.',
        };
      case google.maps.DirectionsStatus.OVER_QUERY_LIMIT:
        return {
          code: 'OVER_QUERY_LIMIT',
          message: 'Troppe richieste. Aspetta e riprova.',
        };
      case google.maps.DirectionsStatus.REQUEST_DENIED:
        return {
          code: 'REQUEST_DENIED',
          message: 'Richiesta percorso negata. Controlla la tua API key.',
        };
      case google.maps.DirectionsStatus.UNKNOWN_ERROR:
      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: 'Errore imprevisto. Riprova.',
        };
    }
  }
}
