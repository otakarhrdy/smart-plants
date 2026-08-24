import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { analyzePlantImage } from "./aiDoctor.js";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" })); // Limit pro nahrávání fotek v Base64

// --- Zod schémata ---
const PlantSchema = z.object({
  name: z.string().min(1, "Název rostliny je povinný"),
  species: z.string().optional(),
  location: z.string().optional(),
  imageUrl: z.string().optional(),
  waterInterval: z.number().int().min(1, "Interval musí být alespoň 1 den"),
  minMoisture: z.number().optional().default(20),
  sensorId: z.string().optional(),
  notes: z.string().optional(),
});

const TelemetrySchema = z.object({
  sensorId: z.string(),
  moisture: z.number(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  lightLux: z.number().optional(),
});

// --- API Endpointy ---

// 1. Získat všechny rostliny včetně posledního měření ze senzoru
app.get("/api/plants", async (_req: Request, res: Response) => {
  try {
    const plants = await prisma.plant.findMany({
      include: {
        readings: {
          orderBy: { createdAt: "desc" },
          take: 1, // Pouze nejnovější záznam ze senzoru
        },
        aiReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastWatered: "asc" }, // Nejdříve ty, které nejdéle nebyly zalité
    });
    return res.json(plants);
  } catch (error) {
    console.error("Chyba při načítání rostlin:", error);
    return res.status(500).json({ error: "Chyba při načítání rostlin" });
  }
});

// 2. Vytvořit novou rostlinu
app.post("/api/plants", async (req: Request, res: Response) => {
  const result = PlantSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }

  try {
    const plant = await prisma.plant.create({
      data: result.data,
    });
    return res.status(201).json(plant);
  } catch (error) {
    return res.status(500).json({ error: "Chyba při ukládání rostliny" });
  }
});

// 3. Tlačítko "Zalito dnes"
app.post("/api/plants/:id/water", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Neplatné ID" });

  try {
    const updated = await prisma.plant.update({
      where: { id },
      data: { lastWatered: new Date() },
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Chyba při aktualizaci zalití" });
  }
});

// 4. Telemetrický endpoint pro ESP32 senzor
app.post("/api/telemetry", async (req: Request, res: Response) => {
  const result = TelemetrySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }

  const { sensorId, moisture, temperature, humidity, lightLux } = result.data;

  try {
    const plant = await prisma.plant.findUnique({ where: { sensorId } });
    if (!plant) {
      return res
        .status(404)
        .json({ error: `Rostlina s čidlem ${sensorId} nebyla nalezena` });
    }

    const reading = await prisma.sensorReading.create({
      data: {
        plantId: plant.id,
        moisture,
        temperature,
        humidity,
        lightLux,
      },
    });

    return res.status(201).json({ message: "Telemetrie uložena", reading });
  } catch (error) {
    return res.status(500).json({ error: "Chyba při ukládání telemetrie" });
  }
});

// 5. Diagnostika rostliny přes Gemini Vision AI
app.post("/api/plants/:id/diagnose", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { imageBase64, mimeType } = req.body;

  if (isNaN(id) || !imageBase64) {
    return res
      .status(400)
      .json({ error: "Chybí ID rostliny nebo obrazová data" });
  }

  try {
    const diagnosis = await analyzePlantImage(
      imageBase64,
      mimeType || "image/jpeg",
    );

    const report = await prisma.aiReport.create({
      data: {
        plantId: id,
        healthStatus: diagnosis.healthStatus,
        diagnosedIssue: diagnosis.diagnosedIssue,
        treatmentAdvice: diagnosis.treatmentAdvice,
      },
    });

    return res.json({ diagnosis, report });
  } catch (error: any) {
    console.error("Chyba AI analýzy:", error);
    return res
      .status(500)
      .json({ error: error.message || "AI diagnostika selhala" });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Plant Server běží na http://localhost:${PORT}`);
});
