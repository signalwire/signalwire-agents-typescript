/**
 * Weather API Skill - Fetches current weather data from OpenWeatherMap.
 *
 * Tier 2 built-in skill: requires WEATHER_API_KEY environment variable.
 * Uses the OpenWeatherMap API to retrieve current weather conditions
 * for a specified location.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

interface WeatherApiResponse {
  name: string;
  sys: { country: string };
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{ main: string; description: string }>;
  wind: { speed: number; deg: number };
  visibility?: number;
  clouds?: { all: number };
  cod: number;
  message?: string;
}

export class WeatherApiSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('weather_api', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'weather_api',
      description:
        'Fetches current weather data from OpenWeatherMap for any location worldwide.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['weather', 'api', 'openweathermap', 'external'],
      requiredEnvVars: ['WEATHER_API_KEY'],
      configSchema: {
        units: {
          type: 'string',
          description:
            'Temperature units: "metric" (Celsius), "imperial" (Fahrenheit), or "standard" (Kelvin).',
          default: 'metric',
        },
      },
    };
  }

  getTools(): SkillToolDefinition[] {
    const units = this.getConfig<string>('units', 'metric');

    return [
      {
        name: 'get_weather',
        description:
          'Get the current weather conditions for a specified location. Returns temperature, humidity, wind speed, and weather description.',
        parameters: {
          location: {
            type: 'string',
            description:
              'The city name, optionally with country code (e.g., "London", "Paris,FR", "New York,US").',
          },
        },
        required: ['location'],
        handler: async (args: Record<string, unknown>) => {
          const location = args.location as string | undefined;

          if (!location || typeof location !== 'string' || location.trim().length === 0) {
            return new SwaigFunctionResult(
              'Please provide a location to get the weather for.',
            );
          }

          const apiKey = process.env['WEATHER_API_KEY'];
          if (!apiKey) {
            return new SwaigFunctionResult(
              'Weather service is not configured. The WEATHER_API_KEY environment variable is missing.',
            );
          }

          try {
            const encodedLocation = encodeURIComponent(location.trim());
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodedLocation}&appid=${apiKey}&units=${units}`;

            const response = await fetch(url);
            const data = (await response.json()) as WeatherApiResponse;

            if (!response.ok || data.cod !== 200) {
              const errorMessage = data.message ?? `HTTP ${response.status}`;
              return new SwaigFunctionResult(
                `Could not retrieve weather for "${location}": ${errorMessage}. Please check the location name and try again.`,
              );
            }

            const unitLabel = units === 'imperial' ? 'F' : units === 'standard' ? 'K' : 'C';
            const speedUnit = units === 'imperial' ? 'mph' : 'm/s';

            const weatherDesc =
              data.weather.length > 0
                ? data.weather.map((w) => w.description).join(', ')
                : 'unknown';

            const parts: string[] = [
              `Weather for ${data.name}, ${data.sys.country}:`,
              `Conditions: ${weatherDesc}.`,
              `Temperature: ${data.main.temp}\u00B0${unitLabel} (feels like ${data.main.feels_like}\u00B0${unitLabel}).`,
              `High: ${data.main.temp_max}\u00B0${unitLabel}, Low: ${data.main.temp_min}\u00B0${unitLabel}.`,
              `Humidity: ${data.main.humidity}%.`,
              `Wind: ${data.wind.speed} ${speedUnit}.`,
              `Pressure: ${data.main.pressure} hPa.`,
            ];

            if (data.visibility !== undefined) {
              const visKm = (data.visibility / 1000).toFixed(1);
              parts.push(`Visibility: ${visKm} km.`);
            }

            if (data.clouds?.all !== undefined) {
              parts.push(`Cloud cover: ${data.clouds.all}%.`);
            }

            return new SwaigFunctionResult(parts.join(' '));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to fetch weather data for "${location}": ${message}`,
            );
          }
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    const units = this.getConfig<string>('units', 'metric');
    const unitDesc =
      units === 'imperial'
        ? 'Fahrenheit'
        : units === 'standard'
          ? 'Kelvin'
          : 'Celsius';

    return [
      {
        title: 'Weather Information',
        body: 'You can look up current weather conditions for any location worldwide.',
        bullets: [
          'Use the get_weather tool when a user asks about current weather conditions.',
          'You can specify a city name, optionally with a country code (e.g., "London", "Paris,FR").',
          `Temperature is reported in ${unitDesc}.`,
          'The weather data includes temperature, humidity, wind speed, pressure, and general conditions.',
          'If the user asks about a forecast or future weather, let them know you can only provide current conditions.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating WeatherApiSkill instances.
 */
export function createSkill(config?: SkillConfig): WeatherApiSkill {
  return new WeatherApiSkill(config);
}
