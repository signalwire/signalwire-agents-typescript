/**
 * Google Maps Skill - Provides directions and place search via Google Maps APIs.
 *
 * Tier 3 built-in skill: requires GOOGLE_MAPS_API_KEY environment variable.
 * Uses Google Directions API for route information and Google Places API
 * for place search and discovery.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

interface DirectionsLeg {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  start_address: string;
  end_address: string;
  steps: Array<{
    html_instructions: string;
    distance: { text: string };
    duration: { text: string };
    travel_mode: string;
  }>;
}

interface DirectionsRoute {
  summary: string;
  legs: DirectionsLeg[];
  warnings: string[];
  copyrights: string;
}

interface DirectionsResponse {
  status: string;
  routes: DirectionsRoute[];
  error_message?: string;
}

interface PlaceCandidate {
  name: string;
  formatted_address: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
  business_status?: string;
  types?: string[];
}

interface PlacesResponse {
  candidates: PlaceCandidate[];
  status: string;
  error_message?: string;
}

export class GoogleMapsSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('google_maps', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'google_maps',
      description:
        'Provides driving/walking/transit directions and place search via Google Maps APIs.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['maps', 'directions', 'places', 'google', 'navigation', 'external'],
      requiredEnvVars: ['GOOGLE_MAPS_API_KEY'],
      configSchema: {
        default_mode: {
          type: 'string',
          description:
            'Default travel mode: "driving", "walking", "bicycling", or "transit". Defaults to "driving".',
          default: 'driving',
        },
      },
    };
  }

  getTools(): SkillToolDefinition[] {
    const defaultMode = this.getConfig<string>('default_mode', 'driving');

    return [
      {
        name: 'get_directions',
        description:
          'Get directions between two locations. Returns distance, duration, and step-by-step directions summary.',
        parameters: {
          origin: {
            type: 'string',
            description:
              'Starting location (address, city name, or place name).',
          },
          destination: {
            type: 'string',
            description:
              'Destination location (address, city name, or place name).',
          },
          mode: {
            type: 'string',
            description:
              `Travel mode: "driving", "walking", "bicycling", or "transit". Defaults to "${defaultMode}".`,
          },
        },
        required: ['origin', 'destination'],
        handler: async (args: Record<string, unknown>) => {
          const origin = args.origin as string | undefined;
          const destination = args.destination as string | undefined;
          const mode = (args.mode as string | undefined) ?? defaultMode;

          if (!origin || typeof origin !== 'string' || origin.trim().length === 0) {
            return new SwaigFunctionResult('Please provide a starting location (origin).');
          }

          if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
            return new SwaigFunctionResult('Please provide a destination.');
          }

          const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
          if (!apiKey) {
            return new SwaigFunctionResult(
              'Google Maps is not configured. The GOOGLE_MAPS_API_KEY environment variable is required.',
            );
          }

          const validModes = ['driving', 'walking', 'bicycling', 'transit'];
          const travelMode = validModes.includes(mode) ? mode : defaultMode;

          try {
            const url =
              `https://maps.googleapis.com/maps/api/directions/json` +
              `?origin=${encodeURIComponent(origin.trim())}` +
              `&destination=${encodeURIComponent(destination.trim())}` +
              `&mode=${travelMode}` +
              `&key=${apiKey}`;

            const response = await fetch(url);
            const data = (await response.json()) as DirectionsResponse;

            if (data.status !== 'OK') {
              const errorMsg = data.error_message ?? data.status;
              return new SwaigFunctionResult(
                `Could not get directions from "${origin}" to "${destination}": ${errorMsg}`,
              );
            }

            if (data.routes.length === 0) {
              return new SwaigFunctionResult(
                `No routes found from "${origin}" to "${destination}".`,
              );
            }

            const route = data.routes[0];
            const leg = route.legs[0];

            const parts: string[] = [
              `Directions from ${leg.start_address} to ${leg.end_address}:`,
              `Mode: ${travelMode}`,
              `Distance: ${leg.distance.text}`,
              `Estimated duration: ${leg.duration.text}`,
            ];

            if (route.summary) {
              parts.push(`Route: via ${route.summary}`);
            }

            parts.push('');
            parts.push('Steps:');

            const maxSteps = Math.min(leg.steps.length, 10);
            for (let i = 0; i < maxSteps; i++) {
              const step = leg.steps[i];
              const instruction = step.html_instructions
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim();
              parts.push(`${i + 1}. ${instruction} (${step.distance.text}, ${step.duration.text})`);
            }

            if (leg.steps.length > maxSteps) {
              parts.push(`... and ${leg.steps.length - maxSteps} more steps.`);
            }

            if (route.warnings.length > 0) {
              parts.push('');
              parts.push(`Note: ${route.warnings.join(' ')}`);
            }

            return new SwaigFunctionResult(parts.join('\n'));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to get directions: ${message}`,
            );
          }
        },
      },
      {
        name: 'find_place',
        description:
          'Search for a place by name or description. Returns the place name, address, rating, and whether it is currently open.',
        parameters: {
          query: {
            type: 'string',
            description:
              'The place to search for (e.g., "pizza near Times Square", "Eiffel Tower", "pharmacy in Chicago").',
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const query = args.query as string | undefined;

          if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new SwaigFunctionResult('Please provide a place to search for.');
          }

          const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
          if (!apiKey) {
            return new SwaigFunctionResult(
              'Google Maps is not configured. The GOOGLE_MAPS_API_KEY environment variable is required.',
            );
          }

          try {
            const fields = 'name,formatted_address,geometry,rating,user_ratings_total,opening_hours,business_status,types';
            const url =
              `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
              `?input=${encodeURIComponent(query.trim())}` +
              `&inputtype=textquery` +
              `&fields=${fields}` +
              `&key=${apiKey}`;

            const response = await fetch(url);
            const data = (await response.json()) as PlacesResponse;

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
              const errorMsg = data.error_message ?? data.status;
              return new SwaigFunctionResult(
                `Place search failed: ${errorMsg}`,
              );
            }

            if (!data.candidates || data.candidates.length === 0) {
              return new SwaigFunctionResult(
                `No places found for "${query}". Try a different search term.`,
              );
            }

            const place = data.candidates[0];
            const parts: string[] = [
              `Place found: ${place.name}`,
              `Address: ${place.formatted_address}`,
            ];

            if (place.rating !== undefined) {
              const ratingInfo = place.user_ratings_total
                ? `${place.rating}/5 (${place.user_ratings_total} reviews)`
                : `${place.rating}/5`;
              parts.push(`Rating: ${ratingInfo}`);
            }

            if (place.opening_hours?.open_now !== undefined) {
              parts.push(`Currently open: ${place.opening_hours.open_now ? 'Yes' : 'No'}`);
            }

            if (place.business_status && place.business_status !== 'OPERATIONAL') {
              parts.push(`Status: ${place.business_status.toLowerCase().replace(/_/g, ' ')}`);
            }

            if (place.types && place.types.length > 0) {
              const readableTypes = place.types
                .filter((t) => !t.startsWith('point_of_interest') && !t.startsWith('establishment'))
                .slice(0, 5)
                .map((t) => t.replace(/_/g, ' '));
              if (readableTypes.length > 0) {
                parts.push(`Type: ${readableTypes.join(', ')}`);
              }
            }

            if (place.geometry?.location) {
              const { lat, lng } = place.geometry.location;
              parts.push(`Coordinates: ${lat}, ${lng}`);
            }

            return new SwaigFunctionResult(parts.join('\n'));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to search for place "${query}": ${message}`,
            );
          }
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    const defaultMode = this.getConfig<string>('default_mode', 'driving');

    return [
      {
        title: 'Google Maps & Directions',
        body: 'You can look up directions between locations and search for places.',
        bullets: [
          'Use the get_directions tool to provide driving, walking, bicycling, or transit directions between two locations.',
          `The default travel mode is ${defaultMode}. The user can request a different mode.`,
          'Directions include total distance, estimated duration, and step-by-step navigation.',
          'Use the find_place tool to search for businesses, landmarks, or any point of interest.',
          'Place results include address, rating, and whether the place is currently open.',
          'Summarize directions naturally rather than reading each step verbatim unless the user asks for details.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating GoogleMapsSkill instances.
 */
export function createSkill(config?: SkillConfig): GoogleMapsSkill {
  return new GoogleMapsSkill(config);
}
