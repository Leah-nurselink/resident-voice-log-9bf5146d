import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, UserPlus, Shield, ShieldOff, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS, ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  claimFirstAdmin, inviteStaff, listStaff, removeStaff, setStaffActive,
  setStaffApproved, setStaffPermission, setStaffRole,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const list = useServerFn(listStaff);
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [hasAnyAdmin, setHasAnyAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: roleData }, { count }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
      ]);
      setIsAdmin(Boolean(roleData));
      setHasAnyAdmin((count ?? 0) > 0);
    })();
  }, []);

  const claim = useServerFn(claimFirstAdmin);
  const claimMut = useMutation({
    mutationFn: () => claim(),
    onSuccess: () => { toast.success("You're now an admin"); window.location.reload(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isAdmin === null || hasAnyAdmin === null) {
    return (
      <AppShell title="Admin" subtitle="Staff & permissions">
        <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin" subtitle="Staff & permissions">
        <Card className="mx-auto max-w-lg">
          <CardHeader><CardTitle>Restricted area</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {!hasAnyAdmin ? (
              <>
                <p>No admin has been set up yet. You can claim the first admin account now.</p>
                <Button onClick={() => claimMut.mutate()} disabled={claimMut.isPending}>
                  {claimMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Claim admin access
                </Button>
              </>
            ) : (
              <p>Only admins can manage staff accounts. Ask an admin to grant you access.</p>
            )}
            <Button variant="ghost" asChild><Link to="/dashboard">Back to dashboard</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return <AdminContent listFn={list} qc={qc} />;
}

function AdminContent({ listFn, qc }: { listFn: () => Promise<Awaited<ReturnType<typeof listStaff>>>; qc: ReturnType<typeof useQueryClient> }) {
  const { data, isLoading } = useQuery({ queryKey: ["staff"], queryFn: () => listFn() });
  const refetch = () => qc.invalidateQueries({ queryKey: ["staff"] });

  const pending = useMemo(() => data?.filter((u) => !u.approved) ?? [], [data]);
  const active = useMemo(() => data?.filter((u) => u.approved && u.isActive) ?? [], [data]);
  const inactive = useMemo(() => data?.filter((u) => u.approved && !u.isActive) ?? [], [data]);

  return (
    <AppShell
      title="Admin"
      subtitle="Staff accounts & permissions"
      action={<InviteDialog onDone={refetch} />}
    >
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active staff ({active.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending approval ({pending.length})</TabsTrigger>
          <TabsTrigger value="inactive">Deactivated ({inactive.length})</TabsTrigger>
        </TabsList>
        {isLoading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <TabsContent value="active"><StaffList rows={active} onChange={refetch} /></TabsContent>
            <TabsContent value="pending"><StaffList rows={pending} onChange={refetch} /></TabsContent>
            <TabsContent value="inactive"><StaffList rows={inactive} onChange={refetch} /></TabsContent>
          </>
        )}
      </Tabs>
    </AppShell>
  );
}

type Row = Awaited<ReturnType<typeof listStaff>>[number];

function StaffList({ rows, onChange }: { rows: Row[]; onChange: () => void }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No users here.</p>;
  }
  return (
    <div className="mt-4 space-y-3">
      {rows.map((u) => <StaffCard key={u.userId} user={u} onChange={onChange} />)}
    </div>
  );
}

function StaffCard({ user, onChange }: { user: Row; onChange: () => void }) {
  const setRole = useServerFn(setStaffRole);
  const setApproved = useServerFn(setStaffApproved);
  const setActive = useServerFn(setStaffActive);
  const setPerm = useServerFn(setStaffPermission);
  const remove = useServerFn(removeStaff);

  const grantedSet = new Set(user.permissions.filter((p) => p.granted).map((p) => p.permission));

  async function changeRole(role: Role) {
    try { await setRole({ data: { userId: user.userId, role } }); toast.success("Role updated"); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function toggleApproved() {
    try { await setApproved({ data: { userId: user.userId, approved: !user.approved } }); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function toggleActive() {
    try { await setActive({ data: { userId: user.userId, isActive: !user.isActive } }); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function togglePerm(permission: string, granted: boolean) {
    try { await setPerm({ data: { userId: user.userId, permission: permission as never, granted } }); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function removeUser() {
    if (!confirm(`Permanently delete ${user.email}?`)) return;
    try { await remove({ data: { userId: user.userId } }); toast.success("User removed"); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{user.fullName || user.email || "Unnamed user"}</CardTitle>
          <p className="text-xs text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
            {!user.approved && <Badge variant="outline" className="border-amber-400 text-amber-700">Pending</Badge>}
            {!user.isActive && <Badge variant="outline" className="border-red-400 text-red-700">Deactivated</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Select value={user.role} onValueChange={(v) => changeRole(v as Role)}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button size="sm" variant="outline" onClick={toggleApproved}>
              {user.approved ? <ShieldOff className="mr-1 h-3.5 w-3.5" /> : <Shield className="mr-1 h-3.5 w-3.5" />}
              {user.approved ? "Revoke approval" : "Approve"}
            </Button>
            <Button size="sm" variant="outline" onClick={toggleActive}>
              <KeyRound className="mr-1 h-3.5 w-3.5" />
              {user.isActive ? "Deactivate" : "Reactivate"}
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={removeUser}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Permissions</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PERMISSIONS.map((p) => {
            const granted = grantedSet.has(p.key);
            return (
              <div key={p.key} className="flex items-center justify-between rounded-md border px-3 py-1.5">
                <span className="text-sm">{p.label}</span>
                <Switch checked={granted} onCheckedChange={(v) => togglePerm(p.key, v)} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function InviteDialog({ onDone }: { onDone: () => void }) {
  const invite = useServerFn(inviteStaff);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("carer");
  const [tempPassword, setTempPassword] = useState(() => generatePassword());
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await invite({ data: { email, fullName, role, tempPassword } });
      toast.success("Staff account created");
      onDone();
      setOpen(false);
      setEmail(""); setFullName(""); setRole("carer"); setTempPassword(generatePassword());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="mr-1 h-4 w-4" /> Invite staff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite a staff member</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input id="invite-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Work email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-pw">Temporary password</Label>
            <Input id="invite-pw" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} required minLength={8} maxLength={72} />
            <p className="text-xs text-muted-foreground">Share securely. Ask the staff member to change it on first sign-in.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let out = "";
  const arr = new Uint8Array(14);
  (globalThis.crypto ?? window.crypto).getRandomValues(arr);
  for (const v of arr) out += chars[v % chars.length];
  return out;
}
