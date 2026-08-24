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
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Schéma pro přidání rostliny
const PlantSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  species: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  waterInterval: z.number().int().min(1),
});

// Testovací root endpoint
app.get("/", (_req: Request, res: Response) => {
  res.send("Smart Plant API běží!");
});

// 1. GET: Získat všechny rostliny
app.get("/api/plants", async (_req: Request, res: Response) => {
  try {
    const plants = await prisma.plant.findMany({
      include: {
        aiReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastWatered: "asc" },
    });
    return res.json(plants);
  } catch (error) {
    console.error("Chyba při čtení:", error);
    return res.status(500).json({ error: "Chyba při načítání rostlin" });
  }
});

// 2. POST: Přidat novou rostlinu
app.post("/api/plants", async (req: Request, res: Response) => {
  console.log("Příchozí požadavek na vytvoření kytky:", req.body);
  const result = PlantSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }

  const { name, species, location, waterInterval } = result.data;

  try {
    const plant = await prisma.plant.create({
      data: {
        name,
        species: species || null,
        location: location || null,
        waterInterval,
        lastWatered: new Date(),
      },
    });
    console.log("Kytka úspěšně uložena do DB:", plant.name);
    return res.status(201).json(plant);
  } catch (error: any) {
    console.error("Chyba DB:", error);
    return res.status(500).json({ error: error.message || "Chyba DB" });
  }
});

// 3. POST: Zalito dnes
app.post("/api/plants/:id/water", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const updated = await prisma.plant.update({
      where: { id },
      data: { lastWatered: new Date() },
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Chyba při zalití" });
  }
});

// 4. DELETE: Smazat rostlinu
app.delete("/api/plants/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await prisma.plant.delete({ where: { id } });
    return res.json({ message: "Smazáno" });
  } catch (error) {
    return res.status(500).json({ error: "Chyba při mazání" });
  }
});

// 5. POST: AI Diagnostika
app.post("/api/plants/:id/diagnose", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { imageBase64, mimeType } = req.body;

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
    return res.status(500).json({ error: error.message || "AI selhala" });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Plant Server běží na http://localhost:${PORT}`);
});
