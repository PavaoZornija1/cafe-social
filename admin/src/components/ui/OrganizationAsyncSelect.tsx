"use client";

import { useCallback, useId, useMemo } from "react";
import { AsyncPaginate, type AsyncPaginateProps } from "react-select-async-paginate";
import type { GroupBase, OptionsOrGroups } from "react-select";
import { fetchAdminOrganizationsPicker } from "@/lib/queries";
import {
  getFilterableSelectStyles,
  type FilterableOption,
} from "@/components/ui/FilterableSelect";

type Additional = { page: number };

type Props = {
  inputId?: string;
  value: string;
  /** Must match `value` whenever it is non-empty (name shown in the control). */
  selected: { id: string; name: string } | null;
  onChange: (nextId: string, nextSelected: { id: string; name: string } | null) => void;
  getToken: () => Promise<string | null>;
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Super-admin organization picker: server search + keyset-style pagination via page index.
 */
export function OrganizationAsyncSelect({
  inputId,
  value,
  selected,
  onChange,
  getToken,
  isDisabled,
  placeholder = "Search organizations…",
  className,
}: Props) {
  const rid = useId();
  const instanceId = inputId ?? rid.replace(/:/g, "");
  const styles = useMemo(
    () => getFilterableSelectStyles<FilterableOption, false>(),
    [],
  );

  const selectedOption = useMemo((): FilterableOption | null => {
    if (!value) return null;
    if (selected?.id === value) return { value, label: selected.name };
    return { value, label: value };
  }, [value, selected]);

  const loadOptions: AsyncPaginateProps<
    FilterableOption,
    GroupBase<FilterableOption>,
    Additional,
    false
  >["loadOptions"] = useCallback(
    async (search, _loaded, additional) => {
      const page = additional?.page ?? 1;
      const res = await fetchAdminOrganizationsPicker(getToken, {
        search,
        page,
        limit: 20,
      });
      const options: OptionsOrGroups<FilterableOption, GroupBase<FilterableOption>> =
        res.items.map((o) => ({ value: o.id, label: o.name }));
      return {
        options,
        hasMore: res.hasMore,
        additional: { page: page + 1 },
      };
    },
    [getToken],
  );

  return (
    <div className={className}>
      <AsyncPaginate<FilterableOption, GroupBase<FilterableOption>, Additional, false>
        instanceId={instanceId}
        debounceTimeout={350}
        additional={{ page: 1 }}
        loadOptions={loadOptions}
        defaultOptions={false}
        value={selectedOption}
        onChange={(opt) => {
          if (!opt || Array.isArray(opt)) {
            onChange("", null);
            return;
          }
          const single = opt as FilterableOption;
          onChange(single.value, { id: single.value, name: single.label });
        }}
        placeholder={placeholder}
        isClearable
        isDisabled={isDisabled}
        menuPosition="fixed"
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        styles={styles}
      />
    </div>
  );
}
