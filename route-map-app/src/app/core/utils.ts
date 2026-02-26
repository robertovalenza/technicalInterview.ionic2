import { Position } from '@capacitor/geolocation';

export function extractLatLng(
  position: Position | null,
): google.maps.LatLngLiteral | null {
  if (!position) return null;
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

export function createGoogleMapsLoader(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    if (typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }

    let checkInterval: ReturnType<typeof setInterval>;

    const checkGoogleMaps = () => {
      if (typeof google !== 'undefined' && google.maps) {
        clearInterval(checkInterval);
        resolve();
      }
    };

    checkInterval = setInterval(checkGoogleMaps, 50);

    setTimeout(() => {
      clearInterval(checkInterval);
      console.error('Google Maps failed to load within', timeoutMs, 'ms');
      resolve();
    }, timeoutMs);
  });
}

export function parsePlacesError(error: any): string {
  if (error?.message) {
    return error.message;
  }
  return 'Errore durante la ricerca. Riprova più tardi.';
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
