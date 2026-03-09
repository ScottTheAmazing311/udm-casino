import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { playerId, currentPasscode, newPasscode } = await request.json();

  if (!playerId || !currentPasscode || !newPasscode) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (newPasscode.length < 1 || newPasscode.length > 20) {
    return NextResponse.json({ error: "Passcode must be 1-20 characters" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify current passcode
  const { data: player } = await supabase
    .from("udm_players")
    .select()
    .eq("id", playerId)
    .eq("passcode", String(currentPasscode))
    .single();

  if (!player) {
    return NextResponse.json({ error: "Wrong current passcode" }, { status: 401 });
  }

  // Update passcode
  const { error } = await supabase
    .from("udm_players")
    .update({
      passcode: String(newPasscode),
      has_changed_passcode: true,
    })
    .eq("id", playerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
