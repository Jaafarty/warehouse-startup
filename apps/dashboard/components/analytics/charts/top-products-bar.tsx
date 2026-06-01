"use client";

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

const config = {
  revenue: { label: "Revenue", color: "var(--chart-4)" },
} satisfies ChartConfig;

type Point = { name: string; revenue: number };

export function TopProductsBar({ data }: { data: Point[] }) {
  const trimmed = data.map((d) => ({
    ...d,
    name: d.name.length > 20 ? d.name.slice(0, 18) + "…" : d.name,
  }));
  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart
        data={trimmed}
        layout="vertical"
        accessibilityLayer
        margin={{ left: 8, right: 16 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(v: number) => `$${Math.round(v)}`}
        />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={120}
        />
        <Tooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="revenue"
          fill="var(--color-revenue)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
