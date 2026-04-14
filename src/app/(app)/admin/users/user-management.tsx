"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUser, changeUserRole, removeUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, Trash2, Shield, ShieldCheck } from "lucide-react";

export interface UserRow {
  id: string;
  email: string;
  role: "admin" | "operator";
  createdAt: string;
  lastSignIn: string | null;
  isCurrentUser: boolean;
}

// ── Invite form ──────────────────────────────

function InviteForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await inviteUser(null, formData);
      setResult(res);
    });
  }

  return (
    <div className="rounded-lg border border-taupe-light bg-white/60 px-6 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
        Invite user
      </p>
      <form action={handleSubmit} className="mt-3 flex items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="invite-email"
            className="mb-1 block text-xs font-medium text-taupe-dark"
          >
            Email
          </label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="name@example.com"
            required
            disabled={pending}
            className="max-w-sm"
          />
        </div>
        <div>
          <label
            htmlFor="invite-role"
            className="mb-1 block text-xs font-medium text-taupe-dark"
          >
            Role
          </label>
          <select
            id="invite-role"
            name="role"
            disabled={pending}
            defaultValue="operator"
            className="h-9 rounded-md border border-taupe-light bg-white px-3 text-sm text-charcoal"
          >
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
          Invite
        </Button>
      </form>

      {result?.error && (
        <p className="mt-2 text-xs text-red-600">{result.error}</p>
      )}
      {result?.success && (
        <p className="mt-2 text-xs text-emerald-600">{result.success}</p>
      )}
    </div>
  );
}

// ── User row ─────────────────────────────────

function UserRowItem({ user }: { user: UserRow }) {
  const router = useRouter();
  const [changePending, startChangeTransition] = useTransition();
  const [removePending, startRemoveTransition] = useTransition();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleToggleRole() {
    const newRole = user.role === "admin" ? "operator" : "admin";
    setFeedback(null);
    startChangeTransition(async () => {
      const res = await changeUserRole(user.id, newRole);
      if (res.error) setFeedback(res.error);
      else router.refresh();
    });
  }

  function handleRemove() {
    setFeedback(null);
    startRemoveTransition(async () => {
      const res = await removeUser(user.id);
      if (res.error) {
        setFeedback(res.error);
        setConfirmingRemove(false);
      } else {
        router.refresh();
      }
    });
  }

  const roleIcon =
    user.role === "admin" ? (
      <ShieldCheck className="h-3.5 w-3.5 text-charcoal" />
    ) : (
      <Shield className="h-3.5 w-3.5 text-taupe" />
    );

  return (
    <div className="flex items-center justify-between border-b border-taupe-light/50 px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        {roleIcon}
        <div>
          <p className="text-sm font-medium text-charcoal">
            {user.email}
            {user.isCurrentUser && (
              <span className="ml-2 text-[10px] font-normal text-taupe">
                (you)
              </span>
            )}
          </p>
          <p className="text-[11px] text-taupe">
            {user.role} &middot; joined{" "}
            {new Date(user.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {user.lastSignIn && (
              <>
                {" "}
                &middot; last sign-in{" "}
                {new Date(user.lastSignIn).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </>
            )}
          </p>
        </div>
      </div>

      {!user.isCurrentUser && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleRole}
            disabled={changePending || removePending}
            title={`Change to ${user.role === "admin" ? "operator" : "admin"}`}
          >
            {changePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>Make {user.role === "admin" ? "operator" : "admin"}</>
            )}
          </Button>

          {!confirmingRemove ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmingRemove(true)}
              disabled={changePending || removePending}
              title="Remove user"
            >
              <Trash2 className="h-3.5 w-3.5 text-taupe-dark" />
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={removePending}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                {removePending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Remove"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingRemove(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {feedback && (
        <p className="ml-4 text-xs text-red-600">{feedback}</p>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────

export function UserManagement({ users }: { users: UserRow[] }) {
  return (
    <div className="space-y-8">
      <InviteForm />

      <div className="rounded-lg border border-taupe-light bg-white/60">
        <div className="border-b border-taupe-light px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
            Team members ({users.length})
          </p>
        </div>

        {users.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-taupe-dark">
              No users yet. Invite someone to get started.
            </p>
          </div>
        ) : (
          users.map((user) => <UserRowItem key={user.id} user={user} />)
        )}
      </div>
    </div>
  );
}
