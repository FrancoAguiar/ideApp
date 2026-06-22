import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_INPUT_LENGTH = 5_000;

type OrganizedIdea = {
  title: string;
  summary: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function cleanText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function limitWords(text: string, maxWords: number) {
  return cleanText(text).split(" ").slice(0, maxWords).join(" ");
}

function parseOrganizedIdea(response: GeminiResponse): OrganizedIdea {
  const rawText = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!rawText) throw new Error("Gemini returned an empty response.");

  const parsed: unknown = JSON.parse(rawText.replace(/^```json\s*|\s*```$/g, ""));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini returned an invalid JSON object.");
  }

  const result = parsed as Record<string, unknown>;
  if (typeof result.title !== "string" || typeof result.summary !== "string") {
    throw new Error("Gemini response is missing title or summary.");
  }

  const title = limitWords(result.title, 6);
  const summary = limitWords(result.summary, 20);
  if (!title || !summary) throw new Error("Gemini returned empty fields.");

  return { title, summary };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini organization failed: GEMINI_API_KEY is not configured.");
    return NextResponse.json({ error: "Idea organization is unavailable." }, { status: 503 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = cleanText(
    typeof input === "object" && input !== null && typeof (input as Record<string, unknown>).text === "string"
      ? ((input as Record<string, unknown>).text as string)
      : "",
  );

  if (!text) return NextResponse.json({ error: "Idea text is required." }, { status: 400 });
  if (text.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: "Idea text is too long." }, { status: 400 });
  }

  const prompt = `Tu tarea es organizar ideas escritas rápidamente.

Corrige errores ortográficos.
Corrige puntuación.
Interpreta abreviaciones.
Mantén la intención original.

Devuelve únicamente JSON válido:

{
  "title": "",
  "summary": ""
}

title:
máximo 6 palabras.

summary:
máximo 20 palabras.

No inventes funcionalidades.
No agregues próximos pasos.
No agregues explicaciones.

Idea original:
${JSON.stringify(text)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                summary: { type: "STRING" },
              },
              required: ["title", "summary"],
            },
          },
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const responseBody = await response.text();
      console.error("Gemini organization request failed", {
        status: response.status,
        statusText: response.statusText,
        responseBody,
      });
      return NextResponse.json({ error: "Gemini could not organize the idea." }, { status: 502 });
    }

    const geminiResponse = (await response.json()) as GeminiResponse;
    return NextResponse.json(parseOrganizedIdea(geminiResponse));
  } catch (error) {
    console.error("Gemini organization failed", error);
    return NextResponse.json({ error: "Gemini could not organize the idea." }, { status: 502 });
  }
}
