"use client";

import { useMemo } from "react";
import { getCountrySelectOptions } from "@/lib/geo/countryOptions";
import { FilterableSelect, type FilterableOption } from "./FilterableSelect";

type Props = {
  id?: string;
  /** ISO 3166-1 alpha-2, e.g. `BA` */
  value: string;
  onChange: (isoCode: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  className?: string;
};

export function CountrySelect({
  id,
  value,
  onChange,
  placeholder = "Search country…",
  isDisabled,
  isClearable = true,
  className,
}: Props) {
  const options = useMemo(() => getCountrySelectOptions(), []);
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  return (
    <FilterableSelect<FilterableOption, false>
      inputId={id}
      containerClassName={className}
      options={options}
      value={selected}
      onChange={(opt) => onChange(opt?.value ?? "")}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isClearable={isClearable}
    />
  );
}
