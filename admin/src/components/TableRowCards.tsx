"use client";

import { flexRender, type Column, type Row } from "@tanstack/react-table";

type TableRowCardsProps<T> = {
  rows: Row<T>[];
  rowClassName?: (row: Row<T>) => string;
  leadCellId?: string;
  /** Column ids rendered in a footer action row (buttons, links). */
  actionCellIds?: string[];
  /** Big monospace styling for verification codes; default for other leads. */
  leadStyle?: "code" | "default";
  /** Show column header labels above non-lead body cells on mobile. */
  showBodyLabels?: boolean;
};

function columnHeaderLabel<T>(column: Column<T, unknown>): string | null {
  const header = column.columnDef.header;
  if (header == null || header === "") return null;
  return typeof header === "string" ? header : null;
}

export function TableRowCards<T>({
  rows,
  rowClassName,
  leadCellId,
  actionCellIds = [],
  leadStyle = "default",
  showBodyLabels = false,
}: TableRowCardsProps<T>) {
  if (rows.length === 0) return null;

  const actionSet = new Set(actionCellIds);

  return (
    <ul className="md:hidden space-y-3">
      {rows.map((row) => {
        const leadCell = leadCellId
          ? row.getVisibleCells().find((c) => c.column.id === leadCellId)
          : undefined;
        const bodyCells = row
          .getVisibleCells()
          .filter((c) => c.column.id !== leadCellId && !actionSet.has(c.column.id));
        const actionCells = row
          .getVisibleCells()
          .filter((c) => actionSet.has(c.column.id));

        return (
          <li
            key={row.id}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${rowClassName?.(row) ?? ""}`}
          >
            {leadCell ? (
              <div
                className={
                  leadStyle === "code"
                    ? "font-mono text-2xl font-bold tracking-wide text-amber-900 mb-2"
                    : "text-sm font-medium text-slate-900 mb-2"
                }
              >
                {flexRender(leadCell.column.columnDef.cell, leadCell.getContext())}
              </div>
            ) : null}
            {bodyCells.length > 0 ? (
              <div className="space-y-2">
                {bodyCells.map((cell) => {
                  const label = showBodyLabels ? columnHeaderLabel(cell.column) : null;
                  return (
                    <div key={cell.id} className="text-sm min-w-0">
                      {label ? (
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 block mb-0.5">
                          {label}
                        </span>
                      ) : null}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {actionCells.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                {actionCells.map((cell) => (
                  <div key={cell.id} className="text-sm shrink-0">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type PerkRow = { perkId: string; code: string; title: string; count: number };

export function PerkCountCards({ rows }: { rows: PerkRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="md:hidden space-y-2 mb-2">
      {rows.map((r) => (
        <li
          key={r.perkId}
          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
        >
          <span className="text-sm text-slate-800 min-w-0">
            <span className="font-mono text-brand">{r.code}</span> {r.title}
          </span>
          <span className="text-sm font-semibold text-slate-700 shrink-0">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

type DayCountRow = { day: string; count: number };

export function DayCountCards({ rows }: { rows: DayCountRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="md:hidden space-y-1.5 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
      {rows.map((r) => (
        <li
          key={r.day}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
        >
          <span className="font-mono text-slate-800">{r.day}</span>
          <span className="font-semibold text-slate-700">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

type HourCountRow = { hour: number; count: number };

export function HourCountCards({ rows }: { rows: HourCountRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="md:hidden space-y-0.5 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs text-slate-600">
      {rows.map((r) => (
        <li key={r.hour} className="flex justify-between gap-4 py-0.5 px-1">
          <span>{String(r.hour).padStart(2, "0")}:00</span>
          <span>{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
