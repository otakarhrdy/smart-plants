import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface PlantDiagnosis {
  plantName: string;
  scientificName: string;
  recommendedWaterIntervalDays: number;
  healthStatus: "Zdravá" | "Potřebuje péči" | "Kritický stav";
  diagnosedIssue: string;
  treatmentAdvice: string;
}

export async function analyzePlantImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
): Promise<PlantDiagnosis> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyzuj tuto pokojovou rostlinu. Urči její český i vědecký název, odhadni její zdravotní stav, navrhni optimální interval zalévání ve dnech. Pokud má žluté listy, skvrny nebo škůdce, popiš závadu a doporuč léčbu.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plantName: { type: Type.STRING },
          scientificName: { type: Type.STRING },
          recommendedWaterIntervalDays: { type: Type.INTEGER },
          healthStatus: {
            type: Type.STRING,
            enum: ["Zdravá", "Potřebuje péči", "Kritický stav"],
          },
          diagnosedIssue: { type: Type.STRING },
          treatmentAdvice: { type: Type.STRING },
        },
        required: [
          "plantName",
          "recommendedWaterIntervalDays",
          "healthStatus",
          "treatmentAdvice",
        ],
      },
    },
  });

  return JSON.parse(response.text || "{}") as PlantDiagnosis;
}
