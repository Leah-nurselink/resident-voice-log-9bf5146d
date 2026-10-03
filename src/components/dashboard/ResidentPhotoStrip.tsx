import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useResidentPhotoUrl } from "@/components/ResidentPhoto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

type R = { id: string; full_name: string; preferred_name: string | null; photo_url: string | null; room_number: string | null };

function Avatar({ r }: { r: R }) {
  const url = useResidentPhotoUrl(r.photo_url);
  const initials = r.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Link to="/residents/$id" params={{ id: r.id }} className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-primary/20 bg-muted text-sm font-semibold text-muted-foreground">
        {url ? <img src={url} alt={r.full_name} className="h-full w-full object-cover" /> : initials}
      </div>
      <span className="line-clamp-1 text-xs font-medium">{r.preferred_name || r.full_name.split(" ")[0]}</span>
      {r.room_number && <span className="text-[10px] text-muted-foreground">Room {r.room_number}</span>}
    </Link>
  );
}

export function ResidentPhotoStrip() {
  const { data = [] } = useQuery({
    queryKey: ["dashboard-resident-photos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("id, full_name, preferred_name, photo_url, room_number")
        .is("discharge_date", null)
        .order("full_name");
      if (error) throw error;
      return data as R[];
    },
  });
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" /> Residents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {data.map((r) => <Avatar key={r.id} r={r} />)}
        </div>
      </CardContent>
    </Card>
  );
}
