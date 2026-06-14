"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { adminDatePickerLocale } from "@/i18n/dateFnsLocale";

function parseIsoToDate(iso: string): Date | null {
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type IsoDateTimePickerProps = {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
};

/**
 * Pick date and time (browser-local); value is ISO 8601 string for API storage.
 */
export function IsoDateTimePicker({ id, value, onChange, disabled }: IsoDateTimePickerProps) {
  const { t, i18n } = useTranslation();
  const selected = useMemo(() => parseIsoToDate(value), [value]);
  const locale = useMemo(() => adminDatePickerLocale(i18n.language), [i18n.language]);

  return (
    <DatePicker
      id={id}
      selected={selected}
      onChange={(date: Date | null) => {
        onChange(date ? date.toISOString() : "");
      }}
      showTimeSelect
      timeIntervals={15}
      dateFormat="PPP p"
      locale={locale}
      isClearable
      disabled={disabled}
      placeholderText={t("admin.common.selectDateTime")}
      wrapperClassName="w-full block"
      popperClassName="z-[120]"
      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
      calendarClassName="!font-sans"
    />
  );
}
