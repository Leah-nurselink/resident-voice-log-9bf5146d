import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLES, type PermissionKey, type Role } from "./permissions";

const RoleEnum = z.enum(ROLES);
const PermKeys = PERMISSIONS.map((p) => p.key) as [PermissionKey, ...PermissionKey[]];
const PermEnum = z.enum(PermKeys);

async function assertAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, approved, is_active, created_at");
    if (rErr) throw new Error(rErr.message);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name");
    if (pErr) throw new Error(pErr.message);

    const { data: perms, error: permErr } = await supabaseAdmin
      .from("user_permissions")
      .select("user_id, permission, granted");
    if (permErr) throw new Error(permErr.message);

    const { data: usersRes, error: uErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (uErr) throw new Error(uErr.message);

    const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);
    const emailMap = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));
    const permMap = new Map<string, { permission: string; granted: boolean }[]>();
    for (const p of perms ?? []) {
      const arr = permMap.get(p.user_id) ?? [];
      arr.push({ permission: p.permission, granted: p.granted });
      permMap.set(p.user_id, arr);
    }

    return (roles ?? []).map((r) => ({
      userId: r.user_id,
      fullName: profileMap.get(r.user_id) ?? "",
      email: emailMap.get(r.user_id) ?? "",
      role: r.role as Role,
      approved: r.approved,
      isActive: r.is_active,
      createdAt: r.created_at,
      permissions: permMap.get(r.user_id) ?? [],
    }));
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email().max(255),
      fullName: z.string().min(1).max(120),
      role: RoleEnum,
      tempPassword: z.string().min(8).max(72),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const newUser = created.user;
    if (!newUser) throw new Error("Failed to create user");

    // handle_new_user trigger created a pending 'carer' row; overwrite with the chosen role, approved + active.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUser.id);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.id, role: data.role, approved: true, is_active: true });
    if (roleErr) throw new Error(roleErr.message);

    // Seed default permissions for this role
    const defaults = DEFAULT_ROLE_PERMISSIONS[data.role];
    if (defaults.length > 0) {
      await supabaseAdmin.from("user_permissions").upsert(
        defaults.map((p) => ({ user_id: newUser.id, permission: p, granted: true })),
        { onConflict: "user_id,permission" },
      );
    }
    return { userId: newUser.id };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: RoleEnum }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role, approved: true, is_active: true });
    if (error) throw new Error(error.message);
    const defaults = DEFAULT_ROLE_PERMISSIONS[data.role];
    if (defaults.length > 0) {
      await supabaseAdmin.from("user_permissions").upsert(
        defaults.map((p) => ({ user_id: data.userId, permission: p, granted: true })),
        { onConflict: "user_id,permission" },
      );
    }
    return { ok: true };
  });

export const setStaffApproved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), approved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles").update({ approved: data.approved }).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles").update({ is_active: data.isActive }).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStaffPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), permission: PermEnum, granted: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_permissions")
      .upsert(
        { user_id: data.userId, permission: data.permission, granted: data.granted },
        { onConflict: "user_id,permission" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot remove your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bootstrap: lets the very first user become an admin when no admin exists yet.
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists. Ask them to grant you access.");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin", approved: true, is_active: true });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_permissions").upsert(
      DEFAULT_ROLE_PERMISSIONS.admin.map((p) => ({ user_id: context.userId, permission: p, granted: true })),
      { onConflict: "user_id,permission" },
    );
    return { ok: true };
  });
