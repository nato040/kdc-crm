import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/page-header";
import { UserManagement, type UserRow } from "./user-management";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Get current user (admin check is handled by layout)
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // Use service client to list auth users (admin API)
  const service = createServiceClient();
  const { data: authData } = await service.auth.admin.listUsers();
  const authUsers = authData?.users ?? [];

  // Fetch all roles
  const { data: roles } = await service
    .from("user_roles")
    .select("user_id, role");

  const roleMap = new Map<string, string>();
  for (const r of roles ?? []) {
    roleMap.set(r.user_id, r.role);
  }

  // Build user list — only include users that have a role assigned
  const users: UserRow[] = authUsers
    .filter((u) => roleMap.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? "unknown",
      role: (roleMap.get(u.id) as "admin" | "operator") ?? "operator",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      isCurrentUser: u.id === currentUser?.id,
    }))
    .sort((a, b) => {
      // Admins first, then by email
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return a.email.localeCompare(b.email);
    });

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage team access and roles"
      />

      <UserManagement users={users} />
    </>
  );
}
