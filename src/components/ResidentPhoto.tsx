import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function useResidentPhotoUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(null); return; }
    if (path.startsWith("http")) { setUrl(path); return; }
    supabase.storage.from("resident-photos").createSignedUrl(path, 3600).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [path]);
  return url;
}

type Props = {
  residentId: string;
  path?: string | null;
  initials: string;
  size?: "sm" | "lg";
  onUploaded?: (path: string) => void;
};

export function ResidentPhoto({ residentId, path, initials, size = "lg", onUploaded }: Props) {
  const url = useResidentPhotoUrl(path);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dim = size === "lg" ? "h-20 w-20" : "h-14 w-14";

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const key = `${residentId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("resident-photos").upload(key, file, { upsert: true });
      if (error) throw error;
      onUploaded?.(key);
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`${dim} overflow-hidden rounded-full bg-secondary grid place-items-center text-lg font-medium text-secondary-foreground`}>
        {url ? <img src={url} alt="Resident photo" className="h-full w-full object-cover" /> : initials}
      </div>
      {onUploaded && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {path ? "Change photo" : "Add photo"}
          </Button>
        </>
      )}
    </div>
  );
}
