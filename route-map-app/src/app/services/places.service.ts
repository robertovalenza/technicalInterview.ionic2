import { Injectable } from '@angular/core';
import { MapConfigService } from './map-config.service';

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
  providedIn: 'root'
})
export class PlacesService {
  private autocompleteService: google.maps.places.AutocompleteService | null = null;
  private placesService: google.maps.places.PlacesService | null = null;
  private predictionsCache = new Map<string, PlacePrediction[]>();
  private readonly cacheMaxSize = 50;

  constructor(private configService: MapConfigService) {}

  private initializeServices(): void {
    if (!this.autocompleteService && google?.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();
    }
  }

  async getPlacePredictions(query: string): Promise<PlacePrediction[]> {
    if (!query || query.length < 1) {
      return [];
    }

    // Check cache
    if (this.predictionsCache.has(query)) {
      return this.predictionsCache.get(query)!;
    }

    this.initializeServices();

    if (!this.autocompleteService) {
      throw new Error('Google Places Autocomplete service not available');
    }

    return new Promise((resolve, reject) => {
      this.autocompleteService!.getPlacePredictions(
        {
          input: query,
          types: ['geocode', 'establishment']
        },
        (predictions, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              resolve([]);
              return;
            }
            reject(new Error(`Places autocomplete failed: ${status}`));
            return;
          }

          const results: PlacePrediction[] = predictions.map(prediction => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting?.main_text || prediction.description,
            secondaryText: prediction.structured_formatting?.secondary_text || ''
          }));

          // Cache results
          this.addToCache(query, results);

          resolve(results);
        }
      );
    });
  }

  async getPlaceDetails(placeId: string): Promise<PlaceResult> {
    this.initializeServices();

    if (!this.placesService) {
      // Create a dummy map element for PlacesService
      const dummyMap = document.createElement('div');
      this.placesService = new google.maps.places.PlacesService(dummyMap);
    }

    return new Promise((resolve, reject) => {
      this.placesService!.getDetails(
        {
          placeId: placeId,
          fields: ['place_id', 'name', 'formatted_address', 'geometry']
        },
        (place, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
            reject(new Error(`Place details not found: ${status}`));
            return;
          }

          if (!place.geometry?.location) {
            reject(new Error('Place has no location data'));
            return;
          }

          const result: PlaceResult = {
            placeId: place.place_id!,
            name: place.name || place.formatted_address || 'Unknown Place',
            formattedAddress: place.formatted_address || '',
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            }
          };

          resolve(result);
        }
      );
    });
  }

  clearCache(): void {
    this.predictionsCache.clear();
  }

  private addToCache(query: string, results: PlacePrediction[]): void {
    // Implement LRU cache
    if (this.predictionsCache.size >= this.cacheMaxSize) {
      const firstKey = this.predictionsCache.keys().next().value;
      if (firstKey) {
        this.predictionsCache.delete(firstKey);
      }
    }
    this.predictionsCache.set(query, results);
  }
}
