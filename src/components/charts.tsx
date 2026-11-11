"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text)" } };

export function BarList({ data }: { data: { name: string; value: number; color?: string }[] }) {
  return (
    <div style={{ height: Math.max(160, data.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip {...tip} cursor={{ fill: "rgba(128,128,128,.1)" }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color ?? "var(--primary)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimeSeries({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 8 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} width={32} />
          <Tooltip {...tip} />
          <Area type="monotone" dataKey="value" name="Documents" stroke="var(--primary)" strokeWidth={2} fill="url(#g)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
