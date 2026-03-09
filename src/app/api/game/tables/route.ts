import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  // Get active tables with their seats
  const { data: tables, error } = await supabase
    .from("udm_tables")
    .select(`
      *,
      udm_seats (*)
    `)
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tables: tables || [] });
}
