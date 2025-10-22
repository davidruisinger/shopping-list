// app/api/transcribe/route.ts
import OpenAI from "openai";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OPTIONAL: raise if you sometimes post longer clips
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // constant-time compare; avoid leaking token length
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyBearer(req: Request) {
  const expected = process.env.TRANSCRIBE_SECRET;
  if (!expected) {
    throw new Error("Missing TRANSCRIBE_SECRET");
  }
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  return timingSafeEqual(provided, expected);
}

export async function POST(req: Request) {
  try {
    // --- Auth guard ---
    if (!verifyBearer(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": "Bearer",
        },
      });
    }

    // --- Basic validation ---
    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({
          error: "Use multipart/form-data with a 'file' field.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "Missing 'file' (audio/wav) in form-data." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Optional: limit MIME types you accept to control spend surface area
    const allowed = new Set([
      "audio/wav",
      "audio/x-wav",
      "audio/mpeg",
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/x-m4a",
    ]);
    if (file.type && !allowed.has(file.type)) {
      return new Response(
        JSON.stringify({ error: `Unsupported content-type: ${file.type}.` }),
        { status: 415, headers: { "content-type": "application/json" } }
      );
    }

    // --- Transcribe via OpenAI ---
    const tr = await openai.audio.transcriptions.create({
      model: "gpt-4o-transcribe",
      file, // File from formData
      language: "de",
      // response_format: "json"
    });

    return new Response(JSON.stringify({ text: tr.text ?? "" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Transcription failed" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
