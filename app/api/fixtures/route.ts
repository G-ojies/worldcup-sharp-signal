import { NextResponse } from "next/server";
import { getFixtures } from "../../../src/txline/client.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always hit TxLINE live (real ingestion)

/**
 * Live World Cup fixtures straight from the TxLINE feed, proving the dashboard
 * ingests real TxLINE data at view-time. Credentials come from env
 * (TXLINE_JWT / TXLINE_API_TOKEN / TXLINE_ORIGIN).
 */
export async function GET() {
  try {
    const fixtures = await getFixtures();
    const now = Date.now();
    const rows = fixtures
      .map((f) => ({
        fixtureId: f.FixtureId,
        home: f.Participant1IsHome ? f.Participant1 : f.Participant2,
        away: f.Participant1IsHome ? f.Participant2 : f.Participant1,
        competition: f.Competition,
        startTime: f.StartTime,
        state: f.StartTime > now ? "upcoming" : "started",
      }))
      .sort((a, b) => a.startTime - b.startTime);
    return NextResponse.json({ ok: true, count: rows.length, fixtures: rows, fetchedAt: now });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, hint: "Set TXLINE_JWT / TXLINE_API_TOKEN / TXLINE_ORIGIN." },
      { status: 502 },
    );
  }
}
