import { Injectable } from '@angular/core';
import { MapConfigService } from './map-config.service';
import { LRUCache } from '../core/utils';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: google.maps.LatLngLiteral;
}

@Injectable({
  providedIn: 'root',
})
export class PlacesService {
  private autocompleteService: google.maps.places.AutocompleteService | null =
    null;
  private placesService: google.maps.places.PlacesService | null = null;
  private predictionsCache = new LRUCache<string, PlacePrediction[]>(50);
  private pendingRequests = new Map<string, Promise<PlacePrediction[]>>();
  private readonly CACHE_KEY = 'places_service_cache';

  constructor(private configService: MapConfigService) {
    this.loadCacheFromStorage();
  }

  private loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([key, value]) => {
          this.predictionsCache.set(key, value as PlacePrediction[]);
        });
      }
    } catch (e) {
      console.warn('Failed to load places cache from storage', e);
    }
  }

  private saveCacheToStorage(): void {
    try {
      const cacheObject: Record<string, PlacePrediction[]> = {};
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject));
    } catch (e) {
      console.warn('Failed to save places cache to storage', e);
    }
  }

  private initializeServices(): void {
    if (!this.autocompleteService && google?.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();
    }
  }

  async getPlacePredictions(query: string): Promise<PlacePrediction[]> {
    if (!query || query.length < 1) {
      return [];
    }

    const cached = this.predictionsCache.get(query);
    if (cached) {
      return cached;
    }

    const pendingRequest = this.pendingRequests.get(query);
    if (pendingRequest) {
      return pendingRequest;
    }

    this.initializeServices();

    if (!this.autocompleteService) {
      throw new Error('Servizio Google Places Autocomplete non disponibile');
    }

    const requestPromise = new Promise<PlacePrediction[]>((resolve, reject) => {
      this.autocompleteService!.getPlacePredictions(
        {
          input: query,
          types: ['geocode', 'establishment'],
        },
        (predictions, status) => {
          this.pendingRequests.delete(query);

          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions
          ) {
            if (
              status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS
            ) {
              resolve([]);
              return;
            }
            reject(new Error(`Places autocomplete failed: ${status}`));
            return;
          }

          const results: PlacePrediction[] = predictions.map((prediction) => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText:
              prediction.structured_formatting?.main_text ||
              prediction.description,
            secondaryText:
              prediction.structured_formatting?.secondary_text || '',
          }));

          // Cache results (LRU)
          this.predictionsCache.set(query, results);

          resolve(results);
        },
      );
    });

    this.pendingRequests.set(query, requestPromise);

    return requestPromise;
  }

  async getPlaceDetails(placeId: string): Promise<PlaceResult> {
    this.initializeServices();

    if (!this.placesService) {
      const dummyMap = document.createElement('div');
      this.placesService = new google.maps.places.PlacesService(dummyMap);
    }

    return new Promise((resolve, reject) => {
      this.placesService!.getDetails(
        {
          placeId: placeId,
          fields: ['place_id', 'name', 'formatted_address', 'geometry'],
        },
        (place, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
            reject(new Error(`Place details not found: ${status}`));
            return;
          }

          if (!place.geometry?.location) {
            reject(new Error('Il luogo non ha dati di posizione'));
            return;
          }

          const result: PlaceResult = {
            placeId: place.place_id!,
            name: place.name || place.formatted_address || 'Luogo Sconosciuto',
            formattedAddress: place.formatted_address || '',
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            },
          };

          resolve(result);
        },
      );
    });
  }

  clearCache(): void {
    this.predictionsCache.clear();
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (e) {
      console.warn('Failed to clear places cache from storage', e);
    }
  }
}
