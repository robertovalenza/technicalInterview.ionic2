import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonSearchbar, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locationOutline, timeOutline } from 'ionicons/icons';
import {
  PlacesService,
  PlacePrediction,
  PlaceResult,
} from '../../services/places.service';
import { MapConfigService } from '../../services/map-config.service';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
  from,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-location-search',
  standalone: true,
  imports: [CommonModule, FormsModule, IonSearchbar, IonIcon, IonSpinner],
  templateUrl: './location-search.component.html',
  styleUrls: ['./location-search.component.scss'],
})
export class LocationSearchComponent {
  private placesService = inject(PlacesService);
  private configService = inject(MapConfigService);

  readonly placeholder = input<string>('Cerca destinazione...');
  readonly disabled = input<boolean>(false);
  readonly placeSelected = output<PlaceResult>();
  readonly searchCleared = output<void>();
  readonly searchError = output<string>();
  readonly useCurrentLocation = output<void>();

  readonly searchQuery = signal<string>('');
  readonly predictions = signal<PlacePrediction[]>([]);
  readonly recentSearches = signal<PlaceResult[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly showPredictions = signal<boolean>(false);
  readonly selectedPlace = signal<PlaceResult | null>(null);
  readonly hasSearchQuery = signal<boolean>(false);

  private searchSubject = new Subject<string>();
  private readonly STORAGE_KEY = 'route_map_recent_searches';
  private readonly MAX_RECENT = 4;

  constructor() {
    addIcons({ locationOutline, timeOutline });
    this.loadRecentSearches();

    const debounceMs = this.configService.getAutocompleteDebounceMs();

    this.searchSubject
      .pipe(
        debounceTime(debounceMs),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.length < 1) {
            this.predictions.set([]);
            this.isSearching.set(false);
            return of([]);
          }
          this.isSearching.set(true);
          return from(this.placesService.getPlacePredictions(query)).pipe(
            catchError((error) => {
              this.searchError.emit(error.message || 'Ricerca fallita');
              return of([]);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((predictions) => {
        this.predictions.set(predictions);
        this.isSearching.set(false);
        this.showPredictions.set(predictions.length > 0);
      });
  }

  onSearchChange(event: CustomEvent): void {
    const query = event.detail.value || '';
    this.searchQuery.set(query);
    this.hasSearchQuery.set(query.length > 0);
    if (this.selectedPlace()) {
      this.selectedPlace.set(null);
      this.searchCleared.emit();
    }
    if (query.length >= 1) {
      this.searchSubject.next(query);
    } else {
      this.predictions.set([]);
      this.showPredictionList();
    }
  }

  private loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.recentSearches.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent searches', e);
    }
  }

  private saveRecentSearch(place: PlaceResult): void {
    const current = this.recentSearches();
    const filtered = current.filter((p) => p.placeId !== place.placeId);
    const updated = [place, ...filtered].slice(0, this.MAX_RECENT);
    this.recentSearches.set(updated);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save recent search', e);
    }
  }

  clearRecentSearches(): void {
    this.recentSearches.set([]);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear recent searches', e);
    }
  }

  onUseCurrentLocation(): void {
    this.useCurrentLocation.emit();
  }

  async onPredictionSelect(prediction: PlacePrediction): Promise<void> {
    this.isSearching.set(true);
    this.showPredictions.set(false);
    try {
      const placeDetails = await this.placesService.getPlaceDetails(
        prediction.placeId,
      );
      this.selectedPlace.set(placeDetails);
      this.searchQuery.set(placeDetails.name);
      this.hasSearchQuery.set(true);
      this.saveRecentSearch(placeDetails);
      this.placeSelected.emit(placeDetails);
    } catch (error) {
      this.searchError.emit('Impossibile ottenere i dettagli del luogo');
    } finally {
      this.isSearching.set(false);
    }
  }

  onRecentSearchSelect(place: PlaceResult): void {
    this.selectedPlace.set(place);
    this.searchQuery.set(place.name);
    this.hasSearchQuery.set(true);
    this.showPredictions.set(false);
    this.placeSelected.emit(place);
  }

  onSearchClear(): void {
    this.searchQuery.set('');
    this.hasSearchQuery.set(false);
    this.predictions.set([]);
    this.showPredictions.set(false);
    this.selectedPlace.set(null);
    this.searchCleared.emit();
  }

  hidePredictions(): void {
    setTimeout(() => {
      this.showPredictions.set(false);
    }, 200);
  }

  showPredictionList(): void {
    if (this.recentSearches().length > 0 || this.predictions().length > 0) {
      this.showPredictions.set(true);
    }
  }
}
