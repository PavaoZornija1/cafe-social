"use client";

import { useId, useMemo } from "react";
import Select, {
  type GroupBase,
  type Props as SelectProps,
  type StylesConfig,
} from "react-select";
import CreatableSelect, {
  type CreatableProps,
} from "react-select/creatable";

const MENU_Z = 130;

export type FilterableOption = { value: string; label: string };

export function getFilterableSelectStyles<
  Option extends FilterableOption,
  IsMulti extends boolean,
>(): StylesConfig<Option, IsMulti, GroupBase<Option>> {
  return {
    control: (base, state) => ({
      ...base,
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: state.isFocused ? "#143368" : "#cbd5e1",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(20, 51, 104, 0.2)" : "none",
      backgroundColor: "#ffffff",
      "&:hover": { borderColor: state.isFocused ? "#143368" : "#94a3b8" },
    }),
    menuPortal: (base) => ({ ...base, zIndex: MENU_Z }),
    menu: (base) => ({ ...base, zIndex: MENU_Z, overflow: "hidden" }),
    menuList: (base) => ({ ...base, paddingTop: 4, paddingBottom: 4 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#143368"
        : state.isFocused
          ? "#eef2fa"
          : "#ffffff",
      color: state.isSelected ? "#ffffff" : "#0f172a",
      cursor: "pointer",
      fontSize: 14,
      padding: "8px 12px",
    }),
    input: (base) => ({ ...base, color: "#0f172a" }),
    singleValue: (base) => ({ ...base, color: "#0f172a" }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "#dfe8f5",
      borderRadius: 6,
    }),
    multiValueLabel: (base) => ({ ...base, color: "#143368", fontWeight: 500 }),
    multiValueRemove: (base) => ({
      ...base,
      color: "#143368",
      ":hover": { backgroundColor: "#c7d2e8", color: "#0f2a52" },
    }),
    placeholder: (base) => ({ ...base, color: "#64748b" }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? "#143368" : "#64748b",
      padding: 8,
    }),
    clearIndicator: (base) => ({
      ...base,
      color: "#64748b",
      padding: 8,
      ":hover": { color: "#0f172a" },
    }),
    valueContainer: (base) => ({ ...base, paddingLeft: 10, paddingRight: 4 }),
  };
}

export type FilterableSelectProps<
  Option extends FilterableOption = FilterableOption,
  IsMulti extends boolean = false,
> = SelectProps<Option, IsMulti, GroupBase<Option>> & {
  /** Class on wrapper div */
  containerClassName?: string;
};

/**
 * Searchable single- or multi-select; menu portals to `document.body` so it works inside modals.
 *
 * Multi-select: pass `isMulti`, `value` as an array of options, and read the array from `onChange`.
 * @example
 * <FilterableSelect isMulti options={opts} value={selected} onChange={setSelected} />
 */
export function FilterableSelect<
  Option extends FilterableOption = FilterableOption,
  IsMulti extends boolean = false,
>({
  containerClassName,
  instanceId: instanceIdProp,
  menuPortalTarget,
  menuPosition = "fixed",
  styles: stylesOverride,
  ...props
}: FilterableSelectProps<Option, IsMulti>) {
  const rid = useId();
  const instanceId = instanceIdProp ?? rid.replace(/:/g, "");
  const baseStyles = useMemo(
    () => getFilterableSelectStyles<Option, IsMulti>(),
    [],
  );
  const styles = useMemo(() => {
    if (!stylesOverride) return baseStyles;
    return { ...baseStyles, ...stylesOverride } as StylesConfig<
      Option,
      IsMulti,
      GroupBase<Option>
    >;
  }, [baseStyles, stylesOverride]);

  return (
    <div className={containerClassName}>
      <Select<Option, IsMulti, GroupBase<Option>>
        instanceId={instanceId}
        unstyled={false}
        isSearchable
        menuPortalTarget={
          menuPortalTarget ??
          (typeof document !== "undefined" ? document.body : null)
        }
        menuPosition={menuPosition}
        hideSelectedOptions={false}
        closeMenuOnSelect={!props.isMulti}
        styles={styles}
        {...props}
      />
    </div>
  );
}

export type FilterableCreatableSelectProps<
  Option extends FilterableOption = FilterableOption,
> = CreatableProps<Option, false, GroupBase<Option>> & {
  containerClassName?: string;
};

/** Single-select that can add a custom string (e.g. city not in the database). */
export function FilterableCreatableSelect<
  Option extends FilterableOption = FilterableOption,
>({
  containerClassName,
  instanceId: instanceIdProp,
  menuPortalTarget,
  menuPosition = "fixed",
  styles: stylesOverride,
  ...props
}: FilterableCreatableSelectProps<Option>) {
  const rid = useId();
  const instanceId = instanceIdProp ?? rid.replace(/:/g, "");
  const baseStyles = useMemo(
    () => getFilterableSelectStyles<Option, false>(),
    [],
  );
  const styles = useMemo(() => {
    if (!stylesOverride) return baseStyles;
    return { ...baseStyles, ...stylesOverride } as StylesConfig<
      Option,
      false,
      GroupBase<Option>
    >;
  }, [baseStyles, stylesOverride]);

  return (
    <div className={containerClassName}>
      <CreatableSelect<Option, false, GroupBase<Option>>
        instanceId={instanceId}
        unstyled={false}
        isSearchable
        menuPortalTarget={
          menuPortalTarget ??
          (typeof document !== "undefined" ? document.body : null)
        }
        menuPosition={menuPosition}
        styles={styles}
        formatCreateLabel={(input) => `Use “${input}”`}
        {...props}
      />
    </div>
  );
}
