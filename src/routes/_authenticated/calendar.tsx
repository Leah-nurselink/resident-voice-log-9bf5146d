import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ArrowUpRight, ClipboardCheck } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { getResidentCalendar } from "@/lib/resident-calendar.functions";

function calendarOptions(month: string) {
  const date = parseISO(`${month}-01`);
  return queryOptions({
    queryKey: ["resident-calendar", month],
    queryFn: () => getResidentCalendar({ data: {
      start: format(startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      end: format(endOfWeek(endOfMonth(date), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    } }),
    staleTime: 0,
  });
}

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month) && Number(search.month.slice(0, 4)) >= 1900 && Number(search.month.slice(0, 4)) <= 2100 ? search.month : format(new Date(), "yyyy-MM"),
    day: typeof search.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.day) && !Number.isNaN(Date.parse(search.day)) ? search.day : "",
    resident: typeof search.resident === "string" ? search.resident : "all",
    kind: search.kind === "appointment" || search.kind === "review" ? search.kind : "all",
  }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(calendarOptions(deps.month)),
  head: () => ({ meta: [
    { title: "Resident calendar · CareCore" },
    { name: "description", content: "Resident appointments and care review dates in one clear calendar." },
    { property: "og:title", content: "Resident calendar · CareCore" },
    { property: "og:description", content: "Resident appointments and care review dates in one clear calendar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CalendarPage,
  errorComponent: CalendarError,
  notFoundComponent: () => <AppShell title="Calendar"><p>Calendar not found.</p></AppShell>,
});

function CalendarError() {
  const router = useRouter();
  return <AppShell title="Calendar"><div role="alert" className="space-y-3"><p>Unable to load appointments and reviews.</p><Button onClick={() => router.invalidate()}>Try again</Button></div></AppShell>;
}

function CalendarPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(calendarOptions(search.month));
  const date = parseISO(`${search.month}-01`);
  const today = format(new Date(), "yyyy-MM-dd");
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) });
  const events = data.events.filter((event) => (search.resident === "all" || event.residentId === search.resident) && (search.kind === "all" || event.kind === search.kind));
  const monthEvents = events.filter((event) => event.date.startsWith(search.month));
  const byDate = new Map<string, typeof events>();
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  const selectedDay = search.day.startsWith(search.month) ? search.day : "";
  const agenda = selectedDay ? (byDate.get(selectedDay) ?? []) : monthEvents;
  const agendaDates = [...new Set(agenda.map((event) => event.date))];
  const changeMonth = (offset: number) => navigate({ search: (previous) => ({ ...previous, month: format(addMonths(date, offset), "yyyy-MM"), day: "" }) });

  return (
    <AppShell title="Calendar" subtitle="Resident appointments & reviews" action={<Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" title="Previous month" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
            <h2 className="min-w-40 text-center text-lg font-semibold">{format(date, "MMMM yyyy")}</h2>
            <Button size="icon" variant="outline" title="Next month" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight /></Button>
          </div>
          <Button variant="outline" onClick={() => navigate({ search: (previous) => ({ ...previous, month: today.slice(0, 7), day: today }) })}>Today</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={search.resident} onValueChange={(resident) => navigate({ search: (previous) => ({ ...previous, resident }) })}>
            <SelectTrigger aria-label="Filter by resident" className="w-full sm:w-64"><SelectValue placeholder="All residents" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All residents</SelectItem>{data.residents.map((resident) => <SelectItem key={resident.id} value={resident.id}>{resident.full_name}{resident.room_number ? ` · Room ${resident.room_number}` : ""}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={search.kind} onValueChange={(kind) => navigate({ search: (previous) => ({ ...previous, kind }) })}>
            <SelectTrigger aria-label="Filter by event type" className="w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Appointments & reviews</SelectItem><SelectItem value="appointment">Appointments</SelectItem><SelectItem value="review">Reviews</SelectItem></SelectContent>
          </Select>
          <Button asChild variant="ghost"><Link to="/reviews"><ClipboardCheck /> Reviews due</Link></Button>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />{monthEvents.filter((event) => event.kind === "appointment").length} appointments</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-care-attention" />{monthEvents.filter((event) => event.kind === "review").length} reviews</span>
        </div>

        <section aria-label="Monthly calendar" className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/50">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dailyEvents = byDate.get(key) ?? [];
              const currentMonth = isSameMonth(day, date);
              return <Button key={key} variant="ghost" aria-label={`${format(day, "EEEE d MMMM yyyy")}, ${dailyEvents.length} events`} aria-pressed={key === selectedDay} onClick={() => navigate({ search: (previous) => ({ ...previous, month: key.slice(0, 7), day: key }) })} className={`h-20 min-w-0 flex-col items-stretch justify-start gap-1 rounded-none border-b border-r p-1.5 text-left sm:h-32 sm:p-2 ${key === selectedDay ? "bg-accent ring-2 ring-inset ring-primary" : ""} ${!currentMonth ? "bg-muted/40 text-muted-foreground" : ""}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-xs ${key === today ? "bg-primary text-primary-foreground" : ""}`}>{format(day, "d")}</span>
                <span className="hidden min-w-0 space-y-1 sm:block">{dailyEvents.slice(0, 2).map((event) => <span key={event.id} className={`block truncate rounded-sm border-l-2 px-1 py-0.5 text-[10px] font-normal ${event.kind === "appointment" ? "border-primary bg-primary/10 text-primary" : "border-care-attention bg-care-attention/10 text-foreground"}`}><span className="font-semibold">{event.residentName}</span> · {event.title}</span>)}{dailyEvents.length > 2 && <span className="block text-[10px] text-muted-foreground">+{dailyEvents.length - 2} more</span>}</span>
                {dailyEvents.length > 0 && <span className="flex flex-wrap items-center gap-1 sm:hidden"><span className="text-[10px] text-muted-foreground">{dailyEvents.length}</span>{dailyEvents.some((event) => event.kind === "appointment") && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}{dailyEvents.some((event) => event.kind === "review") && <span className="h-1.5 w-1.5 rounded-full bg-care-attention" />}</span>}
              </Button>;
            })}
          </div>
        </section>

        <section aria-label="Appointments and reviews" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{selectedDay ? format(parseISO(selectedDay), "EEEE d MMMM") : "This month"} <span className="text-sm font-normal text-muted-foreground">· {agenda.length} events</span></h2>{selectedDay && <Button variant="ghost" size="sm" onClick={() => navigate({ search: (previous) => ({ ...previous, day: "" }) })}>Show whole month</Button>}</div>
          {agenda.length === 0 && <div className="flex items-center gap-3 border-y py-8 text-sm text-muted-foreground"><CalendarDays className="h-5 w-5 shrink-0" />No appointments or reviews {selectedDay ? "on this date" : "this month"}.</div>}
          {agendaDates.map((day) => <div key={day}>
            {!selectedDay && <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{format(parseISO(day), "EEEE d MMMM")}</h3>}
            <div className="divide-y border-y">{agenda.filter((event) => event.date === day).map((event) => <div key={event.id} className="flex flex-wrap items-start gap-3 py-4">
              <span className={`mt-1 rounded-md p-2 ${event.kind === "appointment" ? "bg-primary/10 text-primary" : "bg-care-attention/10 text-foreground"}`}>{event.kind === "appointment" ? <CalendarDays className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1 basis-40 space-y-1"><p className="break-words text-sm font-semibold">{event.residentName} {event.room && <span className="font-normal text-muted-foreground">· Room {event.room}</span>}</p><p className="break-words text-sm">{event.title}</p><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{event.category}</Badge>{event.kind === "review" && event.date < today && <Badge variant="destructive">Overdue</Badge>}<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{event.time ?? "Review due"}</span></div>{event.notes && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{event.notes}</p>}</div>
              <Button asChild size="sm" variant="outline"><Link to="/residents/$id" params={{ id: event.residentId }}>Open resident<ArrowUpRight /></Link></Button>
            </div>)}</div>
          </div>)}
        </section>
      </div>
    </AppShell>
  );
}
