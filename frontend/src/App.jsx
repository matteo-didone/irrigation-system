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

  const handleStartIrrigation = async (controllerId, duration) => {
    try {
      await axios.post(`/api/controllers/${controllerId}/command`, {
        command: "START",
        duration: parseInt(duration),
      });
      await fetchControllers();
    } catch (error) {
      console.error("Error:", error);
      setError("Errore durante l'avvio dell'irrigazione");
    }
  };

  const handleStopIrrigation = async (controllerId) => {
    try {
      await axios.post(`/api/controllers/${controllerId}/command`, {
        command: "STOP",
      });
      await fetchControllers();
    } catch (error) {
      console.error("Error:", error);
      setError("Errore durante l'arresto dell'irrigazione");
    }
  };

  useEffect(() => {
    fetchControllers();
    const interval = setInterval(fetchControllers, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Sistema di Irrigazione</h1>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="space-y-4">
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
