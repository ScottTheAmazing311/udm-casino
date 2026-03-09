import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { joinCode, playerId, playerName } = await request.json();

  if (!joinCode || !playerId || !playerName) {
    return NextResponse.json({ error: "Missing info" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Find table
  const { data: table, error: tableErr } = await supabase
    .from("udm_tables")
    .select()
    .eq("join_code", joinCode.toUpperCase())
    .single();

  if (tableErr || !table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  // Check seat count
  const { data: seats } = await supabase
    .from("udm_seats")
    .select()
    .eq("table_id", table.id);

  if (seats && seats.length >= 6) {
    return NextResponse.json({ error: "Table is full" }, { status: 400 });
  }

  // Check if player already seated
  const existing = seats?.find((s) => s.player_id === playerId);
  if (existing) {
    return NextResponse.json({ table, seat: existing });
  }

  // Add seat
  const { data: seat, error: seatErr } = await supabase
    .from("udm_seats")
    .insert({
      table_id: table.id,
      player_id: playerId,
      player_name: playerName,
      chips: 1000,
    })
    .select()
    .single();

  if (seatErr) {
    return NextResponse.json({ error: seatErr.message }, { status: 500 });
  }

  return NextResponse.json({ table, seat });
}
