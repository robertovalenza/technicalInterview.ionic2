import { Injectable } from '@angular/core';

export interface MarkerConfig {
  color: string;
  size: number;
  title: string;
}

@Injectable({
  providedIn: 'root',
})
export class MarkerService {
  createOrUpdateMarker(
    map: google.maps.Map,
    existingMarker: google.maps.Marker | null,
    position: google.maps.LatLngLiteral,
    icon: google.maps.Icon | string,
    title: string,
  ): google.maps.Marker {
    if (existingMarker) {
      existingMarker.setPosition(position);
      return existingMarker;
    }

    return new google.maps.Marker({
      position,
      map,
      title,
      icon,
    });
  }

  removeMarker(marker: google.maps.Marker | null): void {
    if (marker) {
      marker.setMap(null);
    }
  }

  createLocationMarkerSVG(): string {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <defs>
          <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1"/>
            <feOffset dx="0" dy="1" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.4"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g transform="translate(12, 12)">
          <circle cx="0" cy="0" r="9" fill="white" filter="url(#dotShadow)"/>
          <circle cx="0" cy="0" r="7" fill="#1A73E8"/>
        </g>
      </svg>
    `;
  }

  createLocationMarkerIcon(): google.maps.Icon {
    const svgString = this.createLocationMarkerSVG();
    const svgUrl =
      'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString);

    return {
      url: svgUrl,
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 12),
    };
  }

  createDestinationMarkerIcon(): google.maps.Icon {
    return {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      scaledSize: new google.maps.Size(40, 40),
    };
  }
}
