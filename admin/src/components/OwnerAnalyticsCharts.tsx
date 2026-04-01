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
      <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 mb-2">Visits & redemptions by day</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged}>
              <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                }}
              />
              <Line type="monotone" dataKey="visits" stroke="#a78bfa" name="Unique visitors / day" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="redemptions" stroke="#34d399" name="Redemptions" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {byHour && byHour.some((h) => h.count > 0) ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-500 mb-2">Redemptions by hour (venue timezone when set)</p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour}>
                <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" name="Redemptions" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
