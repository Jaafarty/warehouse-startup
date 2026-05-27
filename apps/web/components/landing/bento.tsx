import {
  Shield,
  Bell,
  Users,
  Building2,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Container, Display } from "./ui";
import { Stagger, StaggerItem, Reveal } from "./reveal";
import { AnalyticsPreview } from "./previews";

function Cell({
  icon: Icon,
  title,
  body,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <StaggerItem
      className={`flex flex-col rounded-3xl border border-border bg-card p-6 ${className ?? ""}`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon size={19} strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      {children}
    </StaggerItem>
  );
}

export function Bento() {
  return (
    <section id="analytics" className="py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="max-w-2xl">
            <Display as="h2" className="text-3xl sm:text-4xl lg:text-5xl">
              One platform, every moving part.
            </Display>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              From analytics to access control, the pieces are already wired
              together.
            </p>
          </div>
        </Reveal>

        <Stagger
          gap={0.07}
          className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:auto-rows-[minmax(184px,auto)]"
        >
          {/* big analytics tile with real chart */}
          <StaggerItem className="flex flex-col rounded-3xl border border-border bg-card p-6 lg:col-span-2 lg:row-span-2">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Analytics that explain the numbers
              </h3>
              <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
                Revenue trends, top products, insights, and daily summaries —
                filterable by range and exportable to CSV.
              </p>
            </div>
            <div className="mt-6 flex-1">
              <AnalyticsPreview />
            </div>
          </StaggerItem>

          <Cell
            icon={Shield}
            title="Roles & permissions"
            body="Owner, admin, employee, viewer — plus custom roles scoped down to individual functions."
          >
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["Owner", "Admin", "Employee", "Custom"].map((r) => (
                <span
                  key={r}
                  className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                >
                  {r}
                </span>
              ))}
            </div>
          </Cell>

          <Cell
            icon={Bell}
            title="Real-time alerts"
            body="Low-stock notifications reach the right people the moment a product hits its reorder point."
            className="bg-primary/[0.04]"
          />

          <Cell
            icon={Building2}
            title="Multi-store"
            body="Run many locations from one account, each with its own members, stock, and reports."
            className="wh-pattern-dots"
          />

          <Cell
            icon={Users}
            title="Customers"
            body="Attach sales to customers, deduplicated by phone number within each store."
          />

          <Cell
            icon={FileSpreadsheet}
            title="Import & export"
            body="Bring your catalog in from a spreadsheet, and export inventory or sales back out anytime."
          />
        </Stagger>
      </Container>
    </section>
  );
}
