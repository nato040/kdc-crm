import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// ── POST — Save API key ─────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate
  let body: { apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();

  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  if (!apiKey.startsWith("pk_")) {
    return NextResponse.json(
      { error: "API key must start with pk_" },
      { status: 400 }
    );
  }

  if (apiKey.length < 8 || apiKey.length > 200) {
    return NextResponse.json(
      { error: "API key must be between 8 and 200 characters" },
      { status: 400 }
    );
  }

  if (/\s/.test(apiKey)) {
    return NextResponse.json(
      { error: "API key must not contain whitespace" },
      { status: 400 }
    );
  }

  // Store in Vault via service role
  const service = createServiceClient();
  const { error } = await service.rpc("set_klaviyo_key", {
    p_client_id: clientId,
    p_api_key: apiKey,
  });

  if (error) {
    console.error("[key] Failed to store API key:", error.message);
    return NextResponse.json(
      { error: "Failed to store API key" },
      { status: 500 }
    );
  }

  // Never echo the key back
  return NextResponse.json({ ok: true });
}

// ── DELETE — Remove API key ─────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Delete vault secret + null out reference in one function call.
  // Zero orphaned secrets.
  const { error } = await service.rpc("delete_klaviyo_key", {
    p_client_id: clientId,
  });

  if (error) {
    console.error("[key] Failed to delete API key:", error.message);
    return NextResponse.json(
      { error: "Failed to remove API key" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
