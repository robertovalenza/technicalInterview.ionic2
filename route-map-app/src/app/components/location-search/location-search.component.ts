import {
  Component,
  input,
  output,
  signal,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonSearchbar, IonList, IonItem, IonLabel, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locationOutline, timeOutline } from 'ionicons/icons';
import { PlacesService, PlacePrediction, PlaceResult } from '../../services/places.service';
import { MapConfigService } from '../../services/map-config.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-location-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonSpinner
  ],
  templateUrl: './location-search.component.html',
  styleUrls: ['./location-search.component.scss']
})
export class LocationSearchComponent {
  private placesService = inject(PlacesService);
  private configService = inject(MapConfigService);

  readonly placeholder = input<string>('Search destination...');
  readonly disabled = input<boolean>(false);
  readonly placeSelected = output<PlaceResult>();
  readonly searchCleared = output<void>();
  readonly searchError = output<string>();

  readonly searchQuery = signal<string>('');
  readonly predictions = signal<PlacePrediction[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly showPredictions = signal<boolean>(false);
  readonly selectedPlace = signal<PlaceResult | null>(null);

  private searchSubject = new Subject<string>();

  constructor() {
    addIcons({ locationOutline, timeOutline });

    const debounceMs = this.configService.getAutocompleteDebounceMs();

    this.searchSubject.pipe(
      debounceTime(debounceMs),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          this.predictions.set([]);
          this.isSearching.set(false);
          return of([]);
        }
        this.isSearching.set(true);
        return from(this.placesService.getPlacePredictions(query)).pipe(
          catchError(error => {
            this.searchError.emit(error.message || 'Search failed');
            return of([]);
          })
        );
      }),
      takeUntilDestroyed()
    ).subscribe(predictions => {
      this.predictions.set(predictions);
      this.isSearching.set(false);
      this.showPredictions.set(predictions.length > 0);
    });
  }

  onSearchChange(event: CustomEvent): void {
    const query = event.detail.value || '';
    this.searchQuery.set(query);
    if (this.selectedPlace()) {
      this.selectedPlace.set(null);
      this.searchCleared.emit();
    }
    this.searchSubject.next(query);
  }

  async onPredictionSelect(prediction: PlacePrediction): Promise<void> {
    this.isSearching.set(true);
    this.showPredictions.set(false);
    try {
      const placeDetails = await this.placesService.getPlaceDetails(prediction.placeId);
      this.selectedPlace.set(placeDetails);
      this.searchQuery.set(placeDetails.name);
      this.placeSelected.emit(placeDetails);
    } catch (error) {
      this.searchError.emit('Failed to get place details');
    } finally {
      this.isSearching.set(false);
    }
  }

  onSearchClear(): void {
    this.searchQuery.set('');
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
    if (this.predictions().length > 0) {
      this.showPredictions.set(true);
    }
  }
}
