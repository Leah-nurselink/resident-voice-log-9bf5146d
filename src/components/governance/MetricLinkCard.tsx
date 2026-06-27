import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricLinkCard({
  label,
  value,
  icon: Icon,
  targetId,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  targetId: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("ring-2", "ring-primary");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
        }
      }}
      className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
    >
      <Card className={cn("transition hover:shadow-md hover:border-primary/40 cursor-pointer")}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-nav-navy">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tap to view</p>
        </CardContent>
      </Card>
    </a>
  );
}

export function DetailSection({
  id,
  title,
  description,
  items,
  emptyText = "Nothing here yet.",
}: {
  id: string;
  title: string;
  description?: string;
  items: { title: string; meta?: string; status?: string }[];
  emptyText?: string;
}) {
  return (
    <Card id={id} className="scroll-mt-24 transition">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{it.title}</p>
                  {it.meta && <p className="text-xs text-muted-foreground">{it.meta}</p>}
                </div>
                {it.status && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {it.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
