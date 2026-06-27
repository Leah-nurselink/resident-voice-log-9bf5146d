import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";

interface Task {
  id: string;
  title: string;
  resident: string;
  time: string;
  priority: "low" | "medium" | "high";
}

const seedTasks: Task[] = [
  { id: "1", title: "Morning medication round", resident: "All wing A", time: "08:00", priority: "high" },
  { id: "2", title: "Reposition — pressure care", resident: "William Johnson", time: "10:00", priority: "high" },
  { id: "3", title: "Fluid intake check", resident: "Eleanor Thompson", time: "11:30", priority: "medium" },
  { id: "4", title: "Physiotherapy session", resident: "John Davies", time: "14:00", priority: "medium" },
  { id: "5", title: "Family call", resident: "Margaret Smith", time: "16:00", priority: "low" },
];

const priorityColor = {
  high: "bg-care-urgent/15 text-care-urgent border-care-urgent/40",
  medium: "bg-care-attention/20 text-care-attention border-care-attention/40",
  low: "bg-care-on-track/15 text-care-on-track border-care-on-track/40",
};

export function TasksList() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Today's Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {seedTasks.map((t) => {
          const isDone = done.has(t.id);
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition hover:shadow-soft"
            >
              <Checkbox checked={isDone} onCheckedChange={() => toggle(t.id)} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                  {t.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.resident} · {t.time}
                </p>
              </div>
              <Badge variant="outline" className={priorityColor[t.priority]}>
                {t.priority}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
