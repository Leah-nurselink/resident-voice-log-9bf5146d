import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Heart, Home, Users, Stethoscope, Mic } from "lucide-react";
import { Switch } from "@/components/ui/switch";


export const DNACPR_OPTIONS = ["Not recorded", "For resuscitation", "DNACPR in place", "Under review"];
export const MARITAL_OPTIONS = ["Single", "Married", "Civil partnership", "Cohabiting", "Separated", "Divorced", "Widowed", "Prefer not to say"];
export const RESIDENCY_OPTIONS = ["Permanent", "Respite", "Day care", "Trial stay", "Hospital admission", "Discharged", "Deceased"];
export const ADMISSION_TYPE = ["Self-funded", "Local authority", "NHS CHC", "Joint funded", "Section 117"];
export const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say", "Other"];

function isValidPhone(v?: string | null): boolean {
  if (!v) return true; // empty allowed
  const cleaned = v.replace(/[\s\-()]/g, "");
  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

type Props = { resident: any };

export function PersonalInfoTab({ resident }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(resident);

  useEffect(() => setForm(resident), [resident.id]);

  const rooms = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("id, name, floor").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createRoom = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("rooms").insert({ name }).select("id, name, floor").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      set("room_number", row.name);
      toast.success(`Room ${row.name} created and assigned`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create room"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const { id, created_at, updated_at, ...patch } = form;
      const { error } = await supabase.from("residents").update(patch).eq("id", resident.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resident details updated");
      qc.invalidateQueries({ queryKey: ["resident", resident.id] });
      qc.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex flex-wrap gap-2">
        {form.dnacpr_status && form.dnacpr_status !== "Not recorded" && (
          <Badge className={form.dnacpr_status === "DNACPR in place"
            ? "bg-destructive/15 text-destructive border-destructive/30"
            : "bg-warning/20 text-warning-foreground border-warning/40"}>
            <Heart className="mr-1 h-3 w-3" /> {form.dnacpr_status}
          </Badge>
        )}
        {form.residency_status && (
          <Badge variant="outline"><Home className="mr-1 h-3 w-3" /> {form.residency_status}</Badge>
        )}
        {form.marital_status && (
          <Badge variant="outline"><Users className="mr-1 h-3 w-3" /> {form.marital_status}</Badge>
        )}
      </div>

      <Section title="Identity" icon={Users}>
        <Grid>
          <Field label="Full name"><Input value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <Field label="Preferred name"><Input value={form.preferred_name ?? ""} onChange={(e) => set("preferred_name", e.target.value)} /></Field>
          <Field label="Date of birth"><Input type="date" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} /></Field>
          <Field label="Gender">
            <SelectBox value={form.gender} onChange={(v) => set("gender", v)} options={GENDER_OPTIONS} />
          </Field>
          <Field label="Pronouns"><Input value={form.pronouns ?? ""} onChange={(e) => set("pronouns", e.target.value)} placeholder="she/her" /></Field>
          <Field label="Marital status">
            <SelectBox value={form.marital_status} onChange={(v) => set("marital_status", v)} options={MARITAL_OPTIONS} />
          </Field>
          <Field label="Religion"><Input value={form.religion ?? ""} onChange={(e) => set("religion", e.target.value)} /></Field>
          <Field label="Ethnicity"><Input value={form.ethnicity ?? ""} onChange={(e) => set("ethnicity", e.target.value)} /></Field>
          <Field label="First language"><Input value={form.first_language ?? ""} onChange={(e) => set("first_language", e.target.value)} /></Field>
          <Field label="Nationality"><Input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} /></Field>
        </Grid>
        <Field label="Previous occupation / life history">
          <Textarea rows={2} value={form.occupation_history ?? ""} onChange={(e) => set("occupation_history", e.target.value)} />
        </Field>
      </Section>

      <Section title="Stay in the care home" icon={Home}>
        <Grid>
          <Field label="Residency status">
            <SelectBox value={form.residency_status} onChange={(v) => set("residency_status", v)} options={RESIDENCY_OPTIONS} />
          </Field>
          <Field label="Admission type / funding">
            <SelectBox value={form.admission_type} onChange={(v) => set("admission_type", v)} options={ADMISSION_TYPE} />
          </Field>
          <Field label="Room">
            <div className="flex gap-2">
              <Select
                value={form.room_number ?? undefined}
                onValueChange={(v) => {
                  if (v === "__new__") {
                    const name = window.prompt("New room name / number (e.g. 12, Bluebell)")?.trim();
                    if (name) createRoom.mutate(name);
                    return;
                  }
                  if (v === "__clear__") { set("room_number", ""); return; }
                  set("room_number", v);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Assign a room…" /></SelectTrigger>
                <SelectContent>
                  {(rooms.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}{r.floor ? ` · ${r.floor}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Create new room…</SelectItem>
                  {form.room_number && <SelectItem value="__clear__">Unassign room</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="Admission date"><Input type="date" value={form.admission_date ?? ""} onChange={(e) => set("admission_date", e.target.value)} /></Field>
          <Field label="Discharge date"><Input type="date" value={form.discharge_date ?? ""} onChange={(e) => set("discharge_date", e.target.value)} /></Field>
          <Field label="Funding source"><Input value={form.funding_source ?? ""} onChange={(e) => set("funding_source", e.target.value)} placeholder="Self / LA name" /></Field>
          <Field label="Local authority"><Input value={form.local_authority ?? ""} onChange={(e) => set("local_authority", e.target.value)} /></Field>
        </Grid>
      </Section>

      <Section title="DNACPR & advance decisions" icon={Heart}>
        <Grid>
          <Field label="DNACPR status">
            <SelectBox value={form.dnacpr_status} onChange={(v) => set("dnacpr_status", v)} options={DNACPR_OPTIONS} />
          </Field>
          <Field label="DNACPR date"><Input type="date" value={form.dnacpr_date ?? ""} onChange={(e) => set("dnacpr_date", e.target.value)} /></Field>
        </Grid>
        <Field label="DNACPR notes / location of form">
          <Textarea rows={2} value={form.dnacpr_notes ?? ""} onChange={(e) => set("dnacpr_notes", e.target.value)} />
        </Field>
        <Field label="Power of attorney (health/finance, contact)">
          <Textarea rows={2} value={form.power_of_attorney ?? ""} onChange={(e) => set("power_of_attorney", e.target.value)} />
        </Field>
        <Field label="Advance decisions / preferences">
          <Textarea rows={2} value={form.advance_decisions ?? ""} onChange={(e) => set("advance_decisions", e.target.value)} />
        </Field>
      </Section>

      <Section title="Medical & care" icon={Stethoscope}>
        <Grid>
          <Field label="NHS number"><Input value={form.nhs_number ?? ""} onChange={(e) => set("nhs_number", e.target.value)} /></Field>
          <Field label="GP practice"><Input value={form.gp_practice ?? ""} onChange={(e) => set("gp_practice", e.target.value)} /></Field>
          <Field label="GP phone"><Input value={form.gp_phone ?? ""} onChange={(e) => set("gp_phone", e.target.value)} /></Field>
        </Grid>
        <Field label="Allergies"><Textarea rows={2} value={form.allergies ?? ""} onChange={(e) => set("allergies", e.target.value)} /></Field>
        <Field label="Dietary requirements"><Textarea rows={2} value={form.dietary_requirements ?? ""} onChange={(e) => set("dietary_requirements", e.target.value)} /></Field>
        <Field label="Communication needs"><Textarea rows={2} value={form.communication_needs ?? ""} onChange={(e) => set("communication_needs", e.target.value)} placeholder="Hearing aid, glasses, language..." /></Field>
      </Section>

      <Section title="Next of kin" icon={Users}>
        <p className="text-xs text-muted-foreground -mt-1 mb-2">Primary contact</p>
        <Grid>
          <Field label="Next of kin name"><Input value={form.next_of_kin ?? ""} onChange={(e) => set("next_of_kin", e.target.value)} /></Field>
          <Field label="Relationship"><Input value={form.next_of_kin_relationship ?? ""} onChange={(e) => set("next_of_kin_relationship", e.target.value)} placeholder="Daughter, Son, Spouse..." /></Field>
          <Field label="Next of kin telephone">
            <Input
              type="tel"
              inputMode="tel"
              value={form.next_of_kin_phone ?? ""}
              onChange={(e) => set("next_of_kin_phone", e.target.value)}
              placeholder="07123 456789 or +44 7123 456789"
              aria-invalid={!isValidPhone(form.next_of_kin_phone)}
              className={!isValidPhone(form.next_of_kin_phone) ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {!isValidPhone(form.next_of_kin_phone) && (
              <p className="text-[11px] text-destructive">Enter a valid UK or international phone number (digits, spaces, + and -).</p>
            )}
          </Field>
        </Grid>
        <p className="text-xs text-muted-foreground mt-4 mb-2">Secondary contact</p>
        <Grid>
          <Field label="Secondary contact name"><Input value={(form as Record<string, unknown>).next_of_kin_secondary as string ?? ""} onChange={(e) => set("next_of_kin_secondary" as never, e.target.value as never)} /></Field>
          <Field label="Relationship"><Input value={(form as Record<string, unknown>).next_of_kin_secondary_relationship as string ?? ""} onChange={(e) => set("next_of_kin_secondary_relationship" as never, e.target.value as never)} placeholder="Daughter, Son, Spouse..." /></Field>
          <Field label="Secondary telephone">
            <Input
              type="tel"
              inputMode="tel"
              value={(form as Record<string, unknown>).next_of_kin_secondary_phone as string ?? ""}
              onChange={(e) => set("next_of_kin_secondary_phone" as never, e.target.value as never)}
              placeholder="07123 456789 or +44 7123 456789"
              aria-invalid={!isValidPhone((form as Record<string, unknown>).next_of_kin_secondary_phone as string | null | undefined)}
              className={!isValidPhone((form as Record<string, unknown>).next_of_kin_secondary_phone as string | null | undefined) ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </Field>
        </Grid>
      </Section>


      <Section title="Recording & transcription consent" icon={Mic}>
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Allow voice recording & AI transcription</Label>
            <p className="text-xs text-muted-foreground">
              When off, staff cannot record calls or voice notes for this resident.
            </p>
          </div>
          <Switch
            checked={form.transcription_enabled ?? true}
            onCheckedChange={(v) => set("transcription_enabled", v)}
          />
        </div>
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Standing consent recorded</Label>
            <p className="text-xs text-muted-foreground">
              Resident (or appropriate representative) has consented to calls being recorded, transcribed and stored in the care record.
            </p>
          </div>
          <Switch
            checked={form.recording_consent ?? false}
            onCheckedChange={(v) => set("recording_consent", v)}
          />
        </div>
        <Grid>
          <Field label="Consent date">
            <Input type="date" value={form.recording_consent_date ?? ""} onChange={(e) => set("recording_consent_date", e.target.value)} />
          </Field>
        </Grid>
        <Field label="Consent notes (who gave consent, capacity, scope)">
          <Textarea rows={2} value={form.recording_consent_notes ?? ""} onChange={(e) => set("recording_consent_notes", e.target.value)} />
        </Field>
      </Section>


      <div className="sticky bottom-2 flex justify-end">
        <Button
          onClick={() => {
            if (!isValidPhone(form.next_of_kin_phone)) {
              toast.error("Next of kin telephone is not valid");
              return;
            }
            save.mutate();
          }}
          disabled={save.isPending}
          className="shadow-elevated"
        >
          <Save className="mr-1 h-4 w-4" /> Save changes
        </Button>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SelectBox({ value, onChange, options }: { value: string | null | undefined; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
