"use client";

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const config = {
  units: { label: "Units", color: "var(--chart-2)" },
} satisfies ChartConfig;

type Point = { date: string; units: number };

export function QuantityTrendChart({ data }: { data: Point[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <LineChart data={formatted} accessibilityLayer margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickMargin={8}
          minTickGap={20}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={40}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="units"
          type="monotone"
          stroke="var(--color-units)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
