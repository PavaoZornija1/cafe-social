"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  placeholder,
  isDisabled,
  className,
}: Props) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("admin.common.searchCity");
  const options = useMemo(
    () => getCityOptionsForCountry(countryCode),
    [countryCode],
  );

  const value = useMemo((): CitySelectOption | null => {
    if (!cityName.trim()) return null;
    const trimmed = cityName.trim();
    const match = options.find(
      (o) =>
        o.meta.name === trimmed ||
        o.meta.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) return match;
    return { value: `__custom__|${encodeURIComponent(trimmed)}`, label: trimmed };
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
        countryCode.trim() ? resolvedPlaceholder : t("admin.common.chooseCountryFirst")
      }
      isDisabled={isDisabled || !countryCode.trim()}
      isClearable
      noOptionsMessage={({ inputValue }) =>
        inputValue.trim()
          ? t("admin.common.cityNoMatch", { name: inputValue.trim() })
          : t("admin.common.cityTypeToSearch")
      }
    />
  );
}
