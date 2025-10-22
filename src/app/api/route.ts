import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    items: [
      "Karotten",
      "Knoblauch",
      "Zwiebeln",
      "Joghurt",
      "Hafermilch",
      "Käse",
      "Tomaten",
      "Paprika",
      "Klopapier",
      "Spüli",
    ],
  });
}

export async function POST(request: Request) {
  const res = await request.json();
  return Response.json({ res });
}
