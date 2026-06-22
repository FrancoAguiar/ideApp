import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_INPUT_LENGTH = 5_000;
const IDEA_CATEGORIES = [
  "Negocio",
  "Diseño",
  "Marketing",
  "Contenido",
  "Automatización",
  "IA",
  "App",
  "Producto",
  "Salud",
  "Finanzas",
  "Personal",
  "Random",
] as const;

type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

type OrganizedIdea = {
  title: string;
  summary: string;
  category: IdeaCategory;
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

function normalizeCategory(value: unknown): IdeaCategory {
  if (typeof value !== "string") return "Random";

  const normalizedValue = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const category = IDEA_CATEGORIES.find(
    (item) => item.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalizedValue,
  );

  return category ?? "Random";
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
  const category = normalizeCategory(result.category);
  if (!title || !summary) throw new Error("Gemini returned empty fields.");

  return { title, summary, category };
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

El usuario escribe rápido y con errores graves de ortografía. Tu trabajo principal es reconstruir correctamente el texto antes de resumirlo.

Primero interpreta la intención completa de la idea, incluso cuando las palabras estén rotas o escritas fonéticamente.
Corrige completamente la ortografía y la puntuación.
Corrige palabras rotas, abreviaciones y errores fonéticos.
Reescribe las frases cuando sea necesario para recuperar su significado en español natural y correcto.
Mantén siempre la intención original.
No copies errores del usuario.
Nunca devuelvas palabras evidentemente mal escritas.

Ejemplo:
Texto: "cra riuna app de intlidancia artifidial para perros que habeln"
Resultado:
{
  "title": "IA para Perros que Hablan",
  "summary": "Aplicación que utiliza inteligencia artificial para simular conversaciones con perros.",
  "category": "App"
}

Devuelve únicamente JSON válido:

{
  "title": "",
  "summary": "",
  "category": ""
}

title:
máximo 6 palabras.

summary:
máximo 20 palabras.

category:
Elige exactamente una categoría de esta lista:
Negocio, Diseño, Marketing, Contenido, Automatización, IA, App, Producto, Salud, Finanzas, Personal, Random.
No inventes categorías nuevas.
Si dudas entre categorías o ninguna encaja claramente, usa Random.

Ejemplos de categorización:
"crear una comunidad para diseñadores" → Negocio
"automatizar mensajes de instagram" → Automatización
"una app para recordar ideas" → App
"usar inteligencia artificial para responder emails" → IA
"rutina para entrenar" → Salud

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
                category: { type: "STRING", enum: IDEA_CATEGORIES },
              },
              required: ["title", "summary", "category"],
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
