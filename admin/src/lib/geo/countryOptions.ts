import { Country } from 'country-state-city';
import type { FilterableOption } from '@/components/ui/FilterableSelect';

let cached: FilterableOption[] | null = null;

/** ISO 3166-1 alpha-2 → English country name, sorted by label. */
export function getCountrySelectOptions(): FilterableOption[] {
  if (!cached) {
    cached = Country.getAllCountries()
      .map((c) => ({ value: c.isoCode, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }
  return cached;
}
