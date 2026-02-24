import { Injectable, signal, computed } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';

export interface GeolocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  // State signals
  readonly currentPosition = signal<Position | null>(null);
  readonly locationError = signal<GeolocationError | null>(null);
  readonly isLocating = signal<boolean>(false);
  readonly permissionStatus = signal<'granted' | 'denied' | 'prompt'>('prompt');

  // Computed signals
  readonly hasPermission = computed(() => this.permissionStatus() === 'granted');
  readonly hasError = computed(() => this.locationError() !== null);

  constructor() {}

  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await Geolocation.requestPermissions();
      this.permissionStatus.set(permission.location === 'granted' ? 'granted' : 'denied');
      return permission.location === 'granted';
    } catch (error) {
      this.permissionStatus.set('denied');
      return false;
    }
  }

  async checkPermissions(): Promise<void> {
    try {
      const permission = await Geolocation.checkPermissions();
      this.permissionStatus.set(permission.location === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      this.permissionStatus.set('denied');
    }
  }

  async getCurrentPosition(): Promise<Position | null> {
    this.isLocating.set(true);
    this.locationError.set(null);

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      this.currentPosition.set(position);
      this.isLocating.set(false);
      return position;
    } catch (error) {
      const geoError = this.parseGeolocationError(error);
      this.locationError.set(geoError);
      this.isLocating.set(false);
      return null;
    }
  }

  async watchPosition(callback: (position: Position) => void): Promise<string | null> {
    try {
      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true },
        (position, err) => {
          if (position) {
            this.currentPosition.set(position);
            callback(position);
          } else if (err) {
            this.locationError.set(this.parseGeolocationError(err));
          }
        }
      );
      return watchId;
    } catch (error) {
      this.locationError.set(this.parseGeolocationError(error));
      return null;
    }
  }

  async clearWatch(watchId: string): Promise<void> {
    await Geolocation.clearWatch({ id: watchId });
  }

  private parseGeolocationError(error: any): GeolocationError {
    const errorCode = error?.code;

    switch (errorCode) {
      case 1:
        return {
          code: 'PERMISSION_DENIED',
          message: 'Location access was denied. Please enable location permissions in settings.'
        };
      case 2:
        return {
          code: 'POSITION_UNAVAILABLE',
          message: 'Unable to determine your location. Please check GPS settings.'
        };
      case 3:
        return {
          code: 'TIMEOUT',
          message: 'Location request timed out. Please try again.'
        };
      default:
        return {
          code: 'UNKNOWN',
          message: error?.message || 'An unknown error occurred while getting location.'
        };
    }
  }

  getErrorMessage(): string {
    return this.locationError()?.message || '';
  }
}
