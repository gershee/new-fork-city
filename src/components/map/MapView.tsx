"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Pin, PinFeatureCollection } from "@/types";

// Set access token
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (token) {
  mapboxgl.accessToken = token;
}

interface MapViewProps {
  pins?: Pin[];
  onPinClick?: (pin: Pin) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
  showHeatmap?: boolean;
  pinListCounts?: Map<string, number>;
  showTrending?: boolean;
}

// NYC center coordinates
const NYC_CENTER: [number, number] = [-73.985428, 40.748817];
const DEFAULT_ZOOM = 12;

// Create emoji marker element
function createEmojiMarker(emoji: string, color: string, onClick: () => void, listCount?: number, isTrending?: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = `emoji-marker ${isTrending ? 'emoji-marker-trending' : ''}`;
  const showBadge = listCount && listCount > 1;
  el.innerHTML = `
    <div class="emoji-marker-bg" style="background-color: ${color}"></div>
    <span class="emoji-marker-icon">${emoji}</span>
    ${showBadge ? `<span class="emoji-marker-badge">${listCount}</span>` : ''}
    ${isTrending ? '<span class="emoji-marker-fire">🔥</span>' : ''}
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

export function MapView({
  pins = [],
  onPinClick,
  onMapClick,
  center = NYC_CENTER,
  zoom = DEFAULT_ZOOM,
  interactive = true,
  showHeatmap = false,
  pinListCounts,
  showTrending = false,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);

  // Use refs to avoid stale closures in event handlers
  const pinsRef = useRef(pins);
  const onPinClickRef = useRef(onPinClick);
  const onMapClickRef = useRef(onMapClick);

  // Keep refs updated
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Convert pins to GeoJSON
  const pinsToGeoJSON = useCallback((pins: Pin[]): PinFeatureCollection => {
    return {
      type: "FeatureCollection",
      features: pins.map((pin) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [pin.lng, pin.lat],
        },
        properties: {
          id: pin.id,
          name: pin.name,
          color: pin.list?.color || "#ff2d92",
          emoji: pin.list?.emoji_icon || "📍",
          listId: pin.list_id,
          listName: pin.list?.name || "",
          userId: pin.user_id,
          isVisited: pin.is_visited,
          rating: pin.personal_rating,
        },
      })),
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: center,
      zoom: zoom,
      pitch: 0,
      bearing: 0,
      interactive: interactive,
      attributionControl: false,
    });

    map.current.on("error", (e) => {
      console.error("Mapbox error:", e);
    });

    map.current.on("load", () => {
      if (!map.current) return;

      // Add custom styling for the dark neon theme (may fail silently on some styles)
      try {
        map.current.setPaintProperty("water", "fill-color", "#0a0a1a");
      } catch {
        // Layer may not exist
      }
      try {
        map.current.setPaintProperty("land", "background-color", "#0f0f1a");
      } catch {
        // Layer may not exist
      }

      // Add attribution in bottom-left
      map.current.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-left"
      );

      // Add navigation controls
      if (interactive) {
        map.current.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "bottom-right"
        );

        // Add geolocation control with auto-trigger
        const geolocateControl = new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        });
        map.current.addControl(geolocateControl, "bottom-right");

        // Auto-trigger geolocation after map loads to show user's location
        setTimeout(() => {
          geolocateControl.trigger();
        }, 500);
      }

      // Add pins source
      map.current.addSource("pins", {
        type: "geojson",
        data: pinsToGeoJSON(pins),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Add cluster circles
      map.current.addLayer({
        id: "clusters",
        type: "circle",
        source: "pins",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#ff2d92",
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 50, 40],
          "circle-opacity": 0.8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ff2d92",
          "circle-stroke-opacity": 0.3,
        },
      });

      // Add cluster count labels
      map.current.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "pins",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 14,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Note: Individual pins are rendered as HTML markers (not layers)
      // This allows proper emoji rendering across all browsers

      // Add heatmap source (separate from clustered pins)
      map.current.addSource("heatmap-pins", {
        type: "geojson",
        data: pinsToGeoJSON(pins),
      });

      // Add heatmap layer
      map.current.addLayer(
        {
          id: "heatmap-layer",
          type: "heatmap",
          source: "heatmap-pins",
          paint: {
            // Increase weight based on rating
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "rating"], 3],
              0, 0.2,
              3, 0.5,
              5, 1
            ],
            // Increase intensity as zoom level increases
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 1,
              15, 3
            ],
            // Color gradient from cool to hot
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0, 0, 0, 0)",
              0.1, "rgba(0, 240, 255, 0.4)",
              0.3, "rgba(177, 78, 255, 0.6)",
              0.5, "rgba(255, 45, 146, 0.7)",
              0.7, "rgba(255, 140, 0, 0.8)",
              1, "rgba(255, 255, 0, 0.9)"
            ],
            // Radius increases with zoom
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 15,
              15, 30
            ],
            // Fade out at high zoom
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14, 1,
              16, 0.6
            ],
          },
        },
        "clusters"
      );

      // Initially hide heatmap
      map.current.setLayoutProperty("heatmap-layer", "visibility", "none");

      setIsLoaded(true);
    });

    // Handle cluster click - zoom in
    map.current.on("click", "clusters", (e) => {
      if (!map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.current.getSource("pins") as mapboxgl.GeoJSONSource;

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || !map.current || zoom == null) return;
        const geometry = features[0].geometry;
        if (geometry.type === "Point") {
          map.current.easeTo({
            center: geometry.coordinates as [number, number],
            zoom,
          });
        }
      });
    });

    // Handle map click (for adding new pins)
    map.current.on("click", (e) => {
      if (!map.current) return;

      // Check if we clicked on a cluster
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });

      if (features.length === 0 && onMapClickRef.current) {
        onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    });

    // Change cursor on hover for clusters
    map.current.on("mouseenter", "clusters", () => {
      if (map.current) map.current.getCanvas().style.cursor = "pointer";
    });
    map.current.on("mouseleave", "clusters", () => {
      if (map.current) map.current.getCanvas().style.cursor = "";
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update pins when they change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const source = map.current.getSource("pins") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(pinsToGeoJSON(pins));
    }
  }, [pins, isLoaded, pinsToGeoJSON]);

  // Update center when it changes
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    map.current.easeTo({ center, duration: 1000 });
  }, [center, isLoaded]);

  // Create/update emoji markers when pins change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const currentMarkers = markersRef.current;
    const newPinIds = new Set(pins.map((p) => p.id));

    // Remove markers for pins that no longer exist
    currentMarkers.forEach((marker, id) => {
      if (!newPinIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });

    // Add or update markers for current pins
    pins.forEach((pin) => {
      // Skip pins without valid list data (defensive check)
      if (!pin.list || !pin.list.emoji_icon) {
        console.warn("[MapView] Skipping pin without valid list data:", pin);
        return;
      }

      if (!currentMarkers.has(pin.id)) {
        const emoji = pin.list.emoji_icon;
        const color = pin.list.color || "#ff2d92";
        const listCount = pinListCounts?.get(pin.id);
        const marker = new mapboxgl.Marker({
          element: createEmojiMarker(emoji, color, () => {
            if (onPinClickRef.current) {
              onPinClickRef.current(pin);
            }
          }, listCount, showTrending),
          anchor: "center",
        })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map.current!);

        currentMarkers.set(pin.id, marker);
      }
    });
  }, [pins, isLoaded, pinListCounts, showTrending]);

  // Toggle heatmap visibility
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const clusterLayers = ["clusters", "cluster-count"];

    if (showHeatmap) {
      // Show heatmap, hide clusters and markers
      map.current.setLayoutProperty("heatmap-layer", "visibility", "visible");
      clusterLayers.forEach((layer) => {
        map.current?.setLayoutProperty(layer, "visibility", "none");
      });
      // Hide emoji markers
      markersRef.current.forEach((marker) => {
        marker.getElement().style.display = "none";
      });
    } else {
      // Hide heatmap, show clusters and markers
      map.current.setLayoutProperty("heatmap-layer", "visibility", "none");
      clusterLayers.forEach((layer) => {
        map.current?.setLayoutProperty(layer, "visibility", "visible");
      });
      // Show emoji markers
      markersRef.current.forEach((marker) => {
        marker.getElement().style.display = "";
      });
    }
  }, [showHeatmap, isLoaded]);

  // Update heatmap data when pins change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const source = map.current.getSource("heatmap-pins") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(pinsToGeoJSON(pins));
    }
  }, [pins, isLoaded, pinsToGeoJSON]);

  // Check for token
  if (!token) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-surface">
        <p className="text-text-muted">Mapbox token not configured</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neon-pink border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-text-muted text-sm">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
