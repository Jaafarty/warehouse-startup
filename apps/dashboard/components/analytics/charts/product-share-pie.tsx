"use client";

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-1)",
  "var(--muted-foreground)",
];

const config = {
  revenue: { label: "Revenue" },
} satisfies ChartConfig;

type Slice = { name: string; revenue: number; pct: number };

export function ProductSharePie({ data }: { data: Slice[] }) {
  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <PieChart accessibilityLayer>
        <Tooltip content={<ChartTooltipContent />} />
        <Pie
          data={data}
          dataKey="revenue"
          nameKey="name"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ChartContainer>
  );
}
