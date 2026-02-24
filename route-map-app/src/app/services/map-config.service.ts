import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface MapConfig {
  apiKey: string;
  defaultCenter: google.maps.LatLngLiteral;
  defaultZoom: number;
  autocompleteDebounceMs: number;
  maxRouteAlternatives: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapConfigService {
  private readonly config: MapConfig = {
    apiKey: environment.googleMapsApiKey,
    defaultCenter: environment.defaultMapCenter,
    defaultZoom: environment.defaultZoom,
    autocompleteDebounceMs: environment.autocompleteDebounceMs,
    maxRouteAlternatives: environment.maxRouteAlternatives
  };

  getConfig(): MapConfig {
    return { ...this.config };
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  getDefaultCenter(): google.maps.LatLngLiteral {
    return { ...this.config.defaultCenter };
  }

  getDefaultZoom(): number {
    return this.config.defaultZoom;
  }

  getAutocompleteDebounceMs(): number {
    return this.config.autocompleteDebounceMs;
  }

  getMaxRouteAlternatives(): number {
    return this.config.maxRouteAlternatives;
  }
}
