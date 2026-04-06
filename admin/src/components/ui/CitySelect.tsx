"use client";

import { useMemo } from "react";
import {
  getCityOptionsForCountry,
  type CityFilterableOption,
} from "@/lib/geo/cityOptions";
import { FilterableCreatableSelect } from "./FilterableSelect";
import type { FilterableOption } from "./FilterableSelect";

type CitySelectOption = CityFilterableOption | FilterableOption;

function isDbCity(o: CitySelectOption): o is CityFilterableOption {
  return "meta" in o && (o as CityFilterableOption).meta != null;
}

type Props = {
  id?: string;
  /** ISO country code (must match CountrySelect). */
  countryCode: string;
  /** City name stored in the API (e.g. `Sarajevo`). */
  cityName: string;
  onChange: (name: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
};

/**
 * Searchable city list from the local `country-state-city` dataset (no external API).
 * Users can add a custom name if their place is missing.
 */
export function CitySelect({
  id,
  countryCode,
  cityName,
  onChange,
  placeholder = "Search or type a city…",
  isDisabled,
  className,
}: Props) {
  const options = useMemo(
    () => getCityOptionsForCountry(countryCode),
    [countryCode],
  );

  const value = useMemo((): CitySelectOption | null => {
    if (!cityName.trim()) return null;
    const t = cityName.trim();
    const match = options.find(
      (o) =>
        o.meta.name === t ||
        o.meta.name.toLowerCase() === t.toLowerCase(),
    );
    if (match) return match;
    return { value: `__custom__|${encodeURIComponent(t)}`, label: t };
  }, [options, cityName]);

  return (
    <FilterableCreatableSelect<CitySelectOption>
      inputId={id}
      containerClassName={className}
      options={options}
      value={value}
      onChange={(opt) => {
        if (!opt) {
          onChange("");
          return;
        }
        if (isDbCity(opt)) {
          onChange(opt.meta.name);
          return;
        }
        onChange(opt.label.trim());
      }}
      onCreateOption={(input) => onChange(input.trim())}
      placeholder={
        countryCode.trim() ? placeholder : "Choose a country first…"
      }
      isDisabled={isDisabled || !countryCode.trim()}
      isClearable
      noOptionsMessage={({ inputValue }) =>
        inputValue.trim()
          ? `No match — press Enter to use “${inputValue.trim()}”`
          : "Type to search cities"
      }
    />
  );
}
