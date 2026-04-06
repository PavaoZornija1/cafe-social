import { City, type ICity } from 'country-state-city';
import type { FilterableOption } from '@/components/ui/FilterableSelect';

export type CityFilterableOption = FilterableOption & { meta: ICity };

/** Stable unique value for react-select (city + state + country). */
export function encodeCityOption(c: ICity): string {
  return `${c.countryCode}|${c.stateCode}|${c.name}`;
}

export function cityToOption(c: ICity): CityFilterableOption {
  const label = c.stateCode ? `${c.name}, ${c.stateCode}` : c.name;
  return {
    value: encodeCityOption(c),
    label,
    meta: c,
  };
}

/** Cities for a country, sorted for scanning in the dropdown. */
export function getCityOptionsForCountry(countryIso: string): CityFilterableOption[] {
  if (!countryIso.trim()) return [];
  const list = City.getCitiesOfCountry(countryIso.trim().toUpperCase());
  if (!list?.length) return [];
  return City.sortByStateAndName(list).map(cityToOption);
}
