import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  const { data: tables } = await supabase
    .from("udm_casino_tables")
    .select("*, udm_casino_seats(*)")
    .eq("is_active", true);

  return NextResponse.json({ tables: tables || [] });
}
