"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

// ── Helper: verify the caller is an admin ──

async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!roleRow || roleRow.role !== "admin") {
    throw new Error("Not authorized");
  }

  return user.id;
}

// ── Invite a new user ──

export async function inviteUser(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not authorized" };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as string;

  if (!email) return { error: "Email is required" };
  if (!role || !["admin", "operator"].includes(role)) {
    return { error: "Role must be admin or operator" };
  }

  const service = createServiceClient();

  // Invite via Supabase Auth admin API — sends a magic link email
  const { data: inviteData, error: inviteError } =
    await service.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    // If user already exists, try to just set their role
    if (inviteError.message?.includes("already been registered")) {
      // Look up existing user
      const { data: listData } = await service.auth.admin.listUsers();
      const existing = listData?.users?.find(
        (u) => u.email?.toLowerCase() === email
      );

      if (existing) {
        const { error: roleError } = await service.from("user_roles").upsert(
          {
            user_id: existing.id,
            role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        if (roleError) return { error: `Failed to set role: ${roleError.message}` };
        revalidatePath("/admin/users");
        return { success: `${email} already exists — role set to ${role}` };
      }

      return { error: "User already registered but could not be found" };
    }

    return { error: inviteError.message };
  }

  if (!inviteData.user) return { error: "Invite sent but no user returned" };

  // Insert role for the newly invited user
  const { error: roleError } = await service.from("user_roles").upsert(
    {
      user_id: inviteData.user.id,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (roleError) {
    return { error: `User invited but failed to set role: ${roleError.message}` };
  }

  revalidatePath("/admin/users");
  return { success: `Invitation sent to ${email} as ${role}` };
}

// ── Change a user's role ──

export async function changeUserRole(
  userId: string,
  newRole: string
): Promise<{ error?: string; success?: string }> {
  try {
    const adminId = await requireAdmin();

    // Prevent admin from demoting themselves
    if (userId === adminId) {
      return { error: "You cannot change your own role" };
    }
  } catch {
    return { error: "Not authorized" };
  }

  if (!["admin", "operator"].includes(newRole)) {
    return { error: "Role must be admin or operator" };
  }

  const service = createServiceClient();

  const { error } = await service.from("user_roles").upsert(
    {
      user_id: userId,
      role: newRole,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: `Role changed to ${newRole}` };
}

// ── Remove a user ──

export async function removeUser(
  userId: string
): Promise<{ error?: string; success?: string }> {
  try {
    const adminId = await requireAdmin();

    // Prevent admin from removing themselves
    if (userId === adminId) {
      return { error: "You cannot remove yourself" };
    }
  } catch {
    return { error: "Not authorized" };
  }

  const service = createServiceClient();

  // Remove the role first
  const { error: roleError } = await service
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (roleError) return { error: `Failed to remove role: ${roleError.message}` };

  // Delete the user from auth
  const { error: authError } = await service.auth.admin.deleteUser(userId);
  if (authError) {
    return { error: `Role removed but failed to delete auth user: ${authError.message}` };
  }

  revalidatePath("/admin/users");
  return { success: "User removed" };
}
