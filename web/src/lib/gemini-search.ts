import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const BASE_INSTRUCTION = `You extract product search parameters from a user's natural-language fashion request.
Return JSON only. The searchTerm must be short keywords (e.g. "women black midi dress", "men white sneakers") suitable for a product search — no full sentences.
If the user is vague, infer the most likely product query. Include gender (men/women) in the searchTerm when relevant.
assistantBrief is one short friendly sentence to show above the results.`;

export async function extractSearchParams(
  message: string,
  options: {
    apiKey: string;
    modelName?: string;
    portfolioBrands?: string[];
  },
): Promise<{ searchTerm: string; assistantBrief: string; maxProducts: number }> {
  const portfolio = options.portfolioBrands?.length
    ? `These brands are on the user's style passport (prefer or align with them when relevant): ${options.portfolioBrands.join(", ")}.`
    : "The user has not added brands to their passport yet.";

  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({
    model: options.modelName ?? "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          searchTerm: {
            type: SchemaType.STRING,
            description: "Concise search keywords for a fashion catalog",
          },
          assistantBrief: {
            type: SchemaType.STRING,
            description: "One short line acknowledging what you are showing",
          },
          maxProducts: {
            type: SchemaType.INTEGER,
            description: "How many products to show, 4–16",
          },
        },
        required: ["searchTerm", "assistantBrief"],
      },
    },
    systemInstruction: `${BASE_INSTRUCTION}\n\n${portfolio}`,
  });

  const result = await model.generateContent(message);
  const text = result.response.text();
  const parsed = JSON.parse(text) as {
    searchTerm?: string;
    assistantBrief?: string;
    maxProducts?: number;
  };

  const searchTerm = String(parsed.searchTerm ?? "").trim();
  const assistantBrief =
    String(parsed.assistantBrief ?? "").trim() || "Here are some picks.";
  let maxProducts = Number(parsed.maxProducts);
  if (!Number.isFinite(maxProducts)) maxProducts = 12;
  maxProducts = Math.min(16, Math.max(4, Math.round(maxProducts)));

  return { searchTerm, assistantBrief, maxProducts };
}
