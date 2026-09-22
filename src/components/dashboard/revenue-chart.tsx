"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyKpi } from "@/lib/analytics/kpi";

export function RevenueChart({ data }: { data: MonthlyKpi[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip
         formatter={(value) => `¥${Number(value).toLocaleString()}`}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-brand-navy)"
          strokeWidth={2}
          name="売上"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}