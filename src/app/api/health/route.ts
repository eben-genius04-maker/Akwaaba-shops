import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// For uptime monitors (e.g. UptimeRobot): 200 when the site and database answer
export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("stores").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
