"use client";

import { enUS } from "date-fns/locale";
import { useMemo } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("en-admin", enUS);

function parseIsoToDate(iso: string): Date | null {
  const t = iso.trim();
  if (!t) return null;
  const d = new Date(t);
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
  const selected = useMemo(() => parseIsoToDate(value), [value]);

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
      locale="en-admin"
      isClearable
      disabled={disabled}
      placeholderText="Select date and time"
      wrapperClassName="w-full block"
      popperClassName="z-[120]"
      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
      calendarClassName="!font-sans"
    />
  );
}
