// File: src/App.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import ControllerCard from "./components/ControllerCard";

function App() {
  const [controllers, setControllers] = useState([]);
  const [error, setError] = useState(null);

  const fetchControllers = async () => {
    try {
      const response = await axios.get("/api/controllers");
      setControllers(response.data);
      setError(null);
    } catch (error) {
      console.error("Error:", error);
      setError("Errore durante il caricamento dei controllori");
    }
  };

  const handleStartIrrigation = async (controllerId, sprinklerId, duration) => {
    try {
      await axios.post(
        `/api/controllers/${controllerId}/sprinklers/${sprinklerId}/command`,
        {
          command: "START",
          duration: parseInt(duration),
        }
      );

      setControllers((prevControllers) =>
        prevControllers.map((controller) =>
          controller.id === controllerId
            ? {
                ...controller,
                sprinklers: controller.sprinklers.map((sprinkler) =>
                  sprinkler.id === sprinklerId
                    ? { ...sprinkler, status: true, duration }
                    : sprinkler
                ),
              }
            : controller
        )
      );
    } catch (error) {
      console.error("Error:", error);
      setError("Errore durante l'avvio dell'irrigazione");
    }
  };

  const handleStopIrrigation = async (controllerId, sprinklerId) => {
    try {
      await axios.post(
        `/api/controllers/${controllerId}/sprinklers/${sprinklerId}/command`,
        {
          command: "STOP",
        }
      );

      setControllers((prevControllers) =>
        prevControllers.map((controller) =>
          controller.id === controllerId
            ? {
                ...controller,
                sprinklers: controller.sprinklers.map((sprinkler) =>
                  sprinkler.id === sprinklerId
                    ? { ...sprinkler, status: false, duration: 0 }
                    : sprinkler
                ),
              }
            : controller
        )
      );
    } catch (error) {
      console.error("Error:", error);
      setError("Errore durante l'arresto dell'irrigazione");
    }
  };

  useEffect(() => {
    fetchControllers();
    const interval = setInterval(fetchControllers, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Sistema di Irrigazione</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {controllers.map((controller) => (
          <ControllerCard
            key={controller.id}
            controller={controller}
            onStartIrrigation={handleStartIrrigation}
            onStopIrrigation={handleStopIrrigation}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
