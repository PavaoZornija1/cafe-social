'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DayPoint = { day: string; count: number };
type HourPoint = { hour: number; count: number };

const BRAND = '#143368';
const gridStroke = '#cbd5e1';
const tickFill = '#64748b';
const tooltipBg = '#ffffff';
const tooltipBorder = '#dfe8f5';

export function OwnerAnalyticsCharts({
  visitsByDay,
  redemptionsByDay,
  byHour,
  title = 'Trends',
}: {
  visitsByDay: DayPoint[];
  redemptionsByDay: DayPoint[];
  byHour: HourPoint[] | null;
  title?: string;
}) {
  const merged = redemptionsByDay.map((r, i) => ({
    day: r.day,
    redemptions: r.count,
    visits: visitsByDay[i]?.count ?? 0,
  }));

  return (
    <div className="mt-8 space-y-8">
      <h3 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h3>
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5 shadow-portal-card">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-muted mb-3">
          Visits & redemptions by day
        </p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: tickFill, fontSize: 10 }} tickLine={false} axisLine={{ stroke: gridStroke }} />
              <YAxis tick={{ fill: tickFill, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 12,
                  boxShadow: '0 8px 30px -8px rgb(20 51 104 / 0.18)',
                }}
              />
              <Line type="monotone" dataKey="visits" stroke={BRAND} name="Unique visitors / day" dot={false} strokeWidth={2.5} />
              <Line type="monotone" dataKey="redemptions" stroke="#0d9488" name="Redemptions" dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {byHour && byHour.some((h) => h.count > 0) ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5 shadow-portal-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-muted mb-3">
            Redemptions by hour (venue timezone when set)
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: tickFill, fontSize: 10 }} tickLine={false} axisLine={{ stroke: gridStroke }} />
                <YAxis tick={{ fill: tickFill, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 12,
                    boxShadow: '0 8px 30px -8px rgb(20 51 104 / 0.18)',
                  }}
                />
                <Bar dataKey="count" fill={BRAND} name="Redemptions" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
