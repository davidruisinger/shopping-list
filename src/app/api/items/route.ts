import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { verifyBearer } from "@/services/auth";
import { addItem, getItems } from "@/services/shopping-list";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OPTIONAL: raise if you sometimes post longer clips
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(req: Request) {
  try {
    // --- Auth guard ---
    if (!verifyBearer(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await getItems();
    return NextResponse.json({
      items: items,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to get items" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // --- Auth guard ---
    if (!verifyBearer(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Basic validation ---
    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error: "Use multipart/form-data with a 'file' field.",
        },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Missing 'file' (audio/wav) in form-data.",
        },
        { status: 400 }
      );
    }

    // Optional: limit MIME types you accept to control spend surface area
    const allowed = new Set([
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mpeg",
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/x-m4a",
    ]);
    if (file.type && !allowed.has(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported content-type: ${file.type}.`,
        },
        { status: 415 }
      );
    }

    // --- Save file to local filesystem (only in development) ---
    if (process.env.NODE_ENV === "development") {
      const uploadsDir = path.join(process.cwd(), "uploads", "audio");

      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileExtension = path.extname(file.name) || ".wav";
      const filename = `audio-${timestamp}${fileExtension}`;
      const filePath = path.join(uploadsDir, filename);

      // Convert File to Buffer and save to filesystem
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
    }

    // --- Transcribe via OpenAI ---
    const tr = await openai.audio.transcriptions.create({
      model: "gpt-4o-transcribe",
      file, // File from formData
      language: "de",
      // response_format: "json"
    });

    const cleanText = (tr.text ?? "").trim().replace(/[.!?]+$/, "");

    await addItem(cleanText);
    const items = await getItems();

    return NextResponse.json({
      added: cleanText,
      items: items,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err?.message ?? "Transcription failed",
      },
      { status: 500 }
    );
  }
}
