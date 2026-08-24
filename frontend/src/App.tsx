import React, { useState, useEffect } from "react";
import {
  Sprout,
  Droplets,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Camera,
  Trash2,
} from "lucide-react";
import "./index.css";

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

  const API_URL = "http://localhost:5000/api";

  // 1. Načtení všech rostlin
  const fetchPlants = async () => {
    try {
      const res = await fetch(`${API_URL}/plants`);
      if (res.ok) {
        const data = await res.json();
        setPlants(data);
      } else {
        console.error("Chyba při stahování dat ze serveru");
      }
    } catch (err) {
      console.error("Chyba spojení s backendem:", err);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  // 2. Přidání nové rostliny (bezpečné ošetření chyb a JSONu)
  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Zadejte prosím název rostliny.");
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        species: species.trim() || undefined,
        location: location.trim() || undefined,
        waterInterval: Number(waterInterval) || 7,
      };

      const res = await fetch(`${API_URL}/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Chyba serveru:", errorText);
        alert(
          `Server vrátil chybu (${res.status}): Zkontrolujte, zda běží backend.`,
        );
        return;
      }

      await res.json();

      // Reset formuláře po úspěchu
      setName("");
      setSpecies("");
      setLocation("");
      setWaterInterval(7);
      setShowAddForm(false);
      fetchPlants();
    } catch (err: any) {
      console.error("Chyba spojení:", err);
      alert(`Nepodařilo se spojit se serverem: ${err.message}`);
    }
  };

  // 3. Tlačítko "Zalito dnes"
  const handleWaterPlant = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/plants/${id}/water`, {
        method: "POST",
      });
      if (res.ok) fetchPlants();
    } catch (err) {
      console.error("Chyba při zalévání:", err);
    }
  };

  // 4. Smazání rostliny
  const handleDeletePlant = async (id: number) => {
    if (!confirm("Opravdu chcete tuto rostlinu odebrat z evidence?")) return;
    try {
      const res = await fetch(`${API_URL}/plants/${id}`, { method: "DELETE" });
      if (res.ok) fetchPlants();
    } catch (err) {
      console.error("Chyba při mazání:", err);
    }
  };

  // 5. AI Lékař rostlin (Gemini Vision)
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
          alert(
            "AI diagnostika selhala. Ověřte GEMINI_API_KEY v souboru backend/.env.",
          );
        }
      } catch (err) {
        console.error("Chyba při AI analýze:", err);
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
          <Sprout size={36} color="#16a34a" /> Smart Plant Care
        </h1>
        <p>Inteligentní správa domácích pokojovek & AI diagnostika</p>
      </header>

      {/* Tlačítko pro přidání */}
      <div className="top-actions">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-toggle"
        >
          <Plus size={16} />{" "}
          {showAddForm ? "Zavřít formulář" : "Přidat novou rostlinu"}
        </button>
      </div>

      {/* Formulář */}
      {showAddForm && (
        <form onSubmit={handleAddPlant} className="form-card">
          <h2
            style={{ fontSize: "1.25rem", color: "#15803d", fontWeight: 700 }}
          >
            Přidat pokojovou rostlinu
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
              placeholder="Umístění (např. Parapet na jih)"
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
            <button type="submit" className="btn-primary">
              <Plus size={18} /> Uložit do profilu
            </button>
          </div>
        </form>
      )}

      {/* Mřížka s kartami rostlin */}
      <div className="plants-grid">
        {plants.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              gridColumn: "1 / -1",
              color: "#94a3b8",
              padding: "3.5rem",
            }}
          >
            Zatím nemáte v evidenci žádné rostliny. Klikněte na tlačítko výše a
            přidejte svou první kytku!
          </div>
        ) : (
          plants.map((plant) => {
            const status = getWateringStatus(plant);
            const latestAiReport = plant.aiReports?.[0];

            return (
              <div key={plant.id} className={`plant-card ${status.type}`}>
                <div className="plant-card-body">
                  <div className="plant-title-row">
                    <div>
                      <h2>{plant.name}</h2>
                      <div className="plant-subtitle">
                        {plant.species || "Pokojová rostlina"}{" "}
                        {plant.location && `• ${plant.location}`}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={`status-badge ${status.badgeClass}`}>
                        {status.icon} {status.text}
                      </span>
                      <button
                        onClick={() => handleDeletePlant(plant.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          padding: "0.2rem",
                        }}
                        title="Smazat rostlinu"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* AI Lékař box */}
                  {latestAiReport && (
                    <div className="ai-box">
                      <div
                        style={{
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          marginBottom: "0.35rem",
                        }}
                      >
                        <Sparkles size={15} color="#16a34a" /> Stav:{" "}
                        {latestAiReport.healthStatus}
                      </div>
                      {latestAiReport.diagnosedIssue && (
                        <div style={{ marginBottom: "0.25rem" }}>
                          <strong>Závada:</strong>{" "}
                          {latestAiReport.diagnosedIssue}
                        </div>
                      )}
                      {latestAiReport.treatmentAdvice && (
                        <div>
                          <strong>Doporučení:</strong>{" "}
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
