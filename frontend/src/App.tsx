import React, { useState, useEffect } from "react";
import {
  Sprout,
  Droplets,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Activity,
  Thermometer,
  SunMedium,
  Camera,
} from "lucide-react";

interface SensorReading {
  id: number;
  moisture: number;
  temperature?: number;
  lightLux?: number;
  createdAt: string;
}

interface AiReport {
  id: number;
  healthStatus: string;
  diagnosedIssue?: string;
  treatmentAdvice?: string;
  createdAt: string;
}

interface Plant {
  id: number;
  name: string;
  species?: string;
  location?: string;
  waterInterval: number;
  lastWatered: string;
  minMoisture?: number;
  sensorId?: string;
  readings: SensorReading[];
  aiReports: AiReport[];
}

export default function App() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loadingAi, setLoadingAi] = useState<number | null>(null);

  // Formulář pro novou rostlinu
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [waterInterval, setWaterInterval] = useState(7);
  const [sensorId, setSensorId] = useState("");

  const API_URL = "http://localhost:5000/api";

  // Načtení rostlin z backendu
  const fetchPlants = async () => {
    try {
      const res = await fetch(`${API_URL}/plants`);
      const data = await res.json();
      setPlants(data);
    } catch (err) {
      console.error("Chyba při stahování rostlin:", err);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  // Tlačítko "Zalito dnes"
  const handleWaterPlant = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/plants/${id}/water`, {
        method: "POST",
      });
      if (res.ok) {
        fetchPlants();
      }
    } catch (err) {
      console.error("Chyba při zalévání:", err);
    }
  };

  // Vytvoření nové rostliny
  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await fetch(`${API_URL}/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          species: species || undefined,
          location: location || undefined,
          waterInterval: Number(waterInterval),
          sensorId: sensorId || undefined,
        }),
      });

      if (res.ok) {
        setName("");
        setSpecies("");
        setLocation("");
        setWaterInterval(7);
        setSensorId("");
        setShowAddForm(false);
        fetchPlants();
      }
    } catch (err) {
      console.error("Chyba při přidávání:", err);
    }
  };

  // AI Lékař: Nahrání fotky a diagnostika
  const handleDiagnose = async (plantId: number, file: File) => {
    setLoadingAi(plantId);
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result as string;

      try {
        const res = await fetch(`${API_URL}/plants/${plantId}/diagnose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64String,
            mimeType: file.type || "image/jpeg",
          }),
        });

        if (res.ok) {
          fetchPlants();
        } else {
          alert("AI diagnostika selhala. Ověřte nastavení GEMINI_API_KEY.");
        }
      } catch (err) {
        console.error("Chyba při odesílání na AI:", err);
      } finally {
        setLoadingAi(null);
      }
    };

    reader.readAsDataURL(file);
  };

  // Výpočet stavu zalévání (Semafor)
  const getWateringStatus = (plant: Plant) => {
    const last = new Date(plant.lastWatered).getTime();
    const now = new Date().getTime();
    const daysSinceWatered = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    const daysRemaining = plant.waterInterval - daysSinceWatered;

    if (daysRemaining < 0) {
      return {
        type: "urgent",
        badgeClass: "badge-urgent",
        text: `Zpoždění o ${Math.abs(daysRemaining)} dny!`,
        icon: <AlertTriangle size={13} />,
      };
    } else if (daysRemaining === 0) {
      return {
        type: "today",
        badgeClass: "badge-today",
        text: "Zalít dnes",
        icon: <Clock size={13} />,
      };
    } else {
      return {
        type: "ok",
        badgeClass: "badge-ok",
        text: `Zalít za ${daysRemaining} dní`,
        icon: <CheckCircle2 size={13} />,
      };
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>
          <Sprout size={36} /> Smart Plant Care
        </h1>
        <p>Inteligentní správa domácích rostlin, IoT čidla & AI lékař</p>
      </header>

      {/* Tlačítko pro rozbalení formuláře */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "1rem",
        }}
      >
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "0.6rem 1rem",
            background: "#1e293b",
            color: "#f1f5f9",
            border: "1px solid #334155",
          }}
        >
          <Plus size={16} />{" "}
          {showAddForm ? "Zavřít formulář" : "Přidat novou rostlinu"}
        </button>
      </div>

      {/* Formulář pro přidání kytky */}
      {showAddForm && (
        <form onSubmit={handleAddPlant} className="form-card">
          <h2 style={{ fontSize: "1.2rem", color: "#4ade80" }}>
            Přidat novou pokojovku
          </h2>
          <div className="form-grid">
            <input
              type="text"
              placeholder="Název (např. Monstera v obýváku)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Druh (např. Monstera Deliciosa)"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            />
            <input
              type="text"
              placeholder="Umístění (např. Parapet jih)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <input
              type="number"
              min="1"
              placeholder="Interval zalévání (dny)"
              value={waterInterval}
              onChange={(e) => setWaterInterval(Number(e.target.value))}
              required
            />
            <input
              type="text"
              placeholder="ID senzoru (ESP32) – nepovinné"
              value={sensorId}
              onChange={(e) => setSensorId(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              <Plus size={18} /> Uložit rostlinu
            </button>
          </div>
        </form>
      )}

      {/* Karty rostlin */}
      <div className="plants-grid">
        {plants.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              gridColumn: "1 / -1",
              color: "#64748b",
              padding: "3rem",
            }}
          >
            Zatím nemáte přidané žádné rostliny. Přidejte svou první pokojovku!
          </div>
        ) : (
          plants.map((plant) => {
            const status = getWateringStatus(plant);
            const latestReading = plant.readings[0];
            const latestAiReport = plant.aiReports[0];

            return (
              <div key={plant.id} className={`plant-card ${status.type}`}>
                <div className="plant-card-body">
                  <div className="plant-title-row">
                    <div>
                      <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                        {plant.name}
                      </h2>
                      <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        {plant.species || "Pokojová rostlina"}{" "}
                        {plant.location && `• ${plant.location}`}
                      </div>
                    </div>
                    <span className={`status-badge ${status.badgeClass}`}>
                      {status.icon} {status.text}
                    </span>
                  </div>

                  {/* Živá telemetrie z čidla */}
                  {latestReading ? (
                    <div className="sensor-box">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          color: "#38bdf8",
                        }}
                      >
                        <Droplets size={16} /> {latestReading.moisture}% vlhkost
                      </div>
                      {latestReading.temperature && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            color: "#f59e0b",
                          }}
                        >
                          <Thermometer size={14} /> {latestReading.temperature}
                          °C
                        </div>
                      )}
                      {latestReading.lightLux && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            color: "#eab308",
                          }}
                        >
                          <SunMedium size={14} /> {latestReading.lightLux} lx
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <Activity size={13} /> Fyzické čidlo není spárováno
                    </div>
                  )}

                  {/* Výsledek z AI diagnostiky */}
                  {latestAiReport && (
                    <div className="ai-box">
                      <div
                        style={{
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <Sparkles size={14} /> AI Stav:{" "}
                        {latestAiReport.healthStatus}
                      </div>
                      {latestAiReport.diagnosedIssue && (
                        <div style={{ marginBottom: "0.2rem" }}>
                          <strong>Závada:</strong>{" "}
                          {latestAiReport.diagnosedIssue}
                        </div>
                      )}
                      {latestAiReport.treatmentAdvice && (
                        <div>
                          <strong>Léčba:</strong>{" "}
                          {latestAiReport.treatmentAdvice}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Akce */}
                  <div className="card-actions">
                    <button
                      onClick={() => handleWaterPlant(plant.id)}
                      className="btn-water"
                    >
                      <Droplets size={16} /> Zalito dnes
                    </button>

                    <label className="btn-ai" style={{ cursor: "pointer" }}>
                      {loadingAi === plant.id ? (
                        <Sparkles size={16} className="animate-spin" />
                      ) : (
                        <Camera size={16} />
                      )}
                      <span>AI Posudek</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleDiagnose(plant.id, e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
