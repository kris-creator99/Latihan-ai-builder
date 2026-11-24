import { NextRequest, NextResponse } from "next/server";

const LUMA_ENDPOINT = "https://luma-api-dev.aicreatorlabs.id/v1/chat/completions";
const LUMA_TIMEOUT_MS = 90_000;

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

function callLuma(apiKey: string, query: string, interactionId: string | null) {
  return fetch(LUMA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      agent_nickname: "acl.agent",
      query,
      interaction_id: interactionId,
    }),
    signal: AbortSignal.timeout(LUMA_TIMEOUT_MS),
  });
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Format permintaan tidak valid." },
      { status: 400 }
    );
  }

  try {
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
    let response = await callLuma(apiKey, message, lastInteractionId);
    let contextReset = false;

    // interaction_id kedaluwarsa/tidak dikenal → mulai percakapan baru agar user tidak terjebak
    if (response.status === 404 && lastInteractionId) {
      console.warn("Lumagen: interaction_id tidak ditemukan, memulai percakapan baru.");
      response = await callLuma(apiKey, message, null);
      contextReset = true;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lumagen API Error:", response.status, errorText);
      return NextResponse.json(
        { error: `Gagal berkomunikasi dengan ACL Agent (${response.status})` },
        { status: response.status >= 500 ? 502 : response.status }
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
      context_reset: contextReset,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "ACL Agent terlalu lama merespons. Coba kirim ulang pertanyaanmu." },
        { status: 504 }
      );
    }
    console.error("Internal Server Error:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server internal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
