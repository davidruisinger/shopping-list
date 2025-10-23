import crypto from "crypto";

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // constant-time compare; avoid leaking token length
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function verifyBearer(req: Request) {
  const expected = process.env.BEARER_TOKEN;
  if (!expected) {
    throw new Error("Missing BEARER_TOKEN");
  }
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  return timingSafeEqual(provided, expected);
}
