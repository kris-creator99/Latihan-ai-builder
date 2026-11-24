import { NextRequest, NextResponse } from "next/server";

const LUMA_ENDPOINT = "https://luma-api-dev.aicreatorlabs.id/v1/chat/completions";

interface ChatRequestBody {
  message?: unknown;
  lastInteractionId?: unknown;
}

interface LumaResponse {
  content?: string;
  interaction_id?: string;
  conversation_id?: string;
  references?: unknown[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const message = body.message;
    const lastInteractionId =
      typeof body.lastInteractionId === "string" ? body.lastInteractionId : null;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong." },
        { status: 400 }
      );
    }

    const apiKey = process.env.LUMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "LUMA_API_KEY belum dikonfigurasi di server environment." },
        { status: 500 }
      );
    }

    // Panggil endpoint resmi Lumagen API v1
    const response = await fetch(LUMA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        agent_nickname: "acl.agent",
        query: message,
        interaction_id: lastInteractionId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lumagen API Error:", response.status, errorText);
      return NextResponse.json(
        { error: `Gagal berkomunikasi dengan ACL Agent (${response.status})` },
        { status: response.status }
      );
    }

    const data = (await response.json()) as LumaResponse;

    // Lumagen menyisipkan penanda sitasi <c>uuid,...</c>; referensi sudah dikirim terpisah
    const reply = (data.content ?? "").replace(/<c>[\s\S]*?<\/c>/g, "").trim();

    return NextResponse.json({
      reply,
      interaction_id: data.interaction_id ?? null,
      conversation_id: data.conversation_id ?? null,
      references: data.references ?? [],
    });
  } catch (error: unknown) {
    console.error("Internal Server Error:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server internal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
