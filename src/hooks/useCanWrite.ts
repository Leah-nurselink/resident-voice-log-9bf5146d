import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PermissionKey } from "@/lib/permissions";

/** True when the signed-in user holds the permission, or is an admin/manager. */
export function useCanWrite(permission: PermissionKey) {
  const { data } = useQuery({
    queryKey: ["can-write", permission],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return false;
      const [{ data: roles }, { data: perms }] = await Promise.all([
        supabase.from("user_roles").select("role, approved, is_active").eq("user_id", uid),
        supabase.from("user_permissions").select("permission, granted").eq("user_id", uid),
      ]);
      const active = (roles ?? []).filter((r) => r.approved && r.is_active);
      if (active.some((r) => r.role === "admin" || r.role === "manager")) return true;
      return (perms ?? []).some((p) => p.permission === permission && p.granted);
    },
  });
  return data ?? false;
}
