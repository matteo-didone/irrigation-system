// File: src/components/ControllerCard.jsx
import React, { useState } from "react";

const ControllerCard = ({
  controller,
  onStartIrrigation,
  onStopIrrigation,
}) => {
  const [selectedDurations, setSelectedDurations] = useState({});

  const handleStart = (sprinklerId) => {
    console.log(
      `Starting sprinkler ${sprinklerId} with duration:`,
      selectedDurations[sprinklerId]
    );
    onStartIrrigation(
      controller.id,
      sprinklerId,
      selectedDurations[sprinklerId] || 5
    );
  };

  const handleStop = (sprinklerId) => {
    console.log(`Stopping sprinkler ${sprinklerId}`);
    onStopIrrigation(controller.id, sprinklerId);
  };

  const getSystemStatus = () => {
    if (!controller.status) {
      return {
        label: "Offline",
        classes: "bg-red-100 text-red-800",
      };
    }

    const hasActiveIrrigators = controller.sprinklers?.some((s) => s.status);
    if (hasActiveIrrigators) {
      return {
        label: "Attivo",
        classes: "bg-green-100 text-green-800",
      };
    }

    return {
      label: "Inattivo",
      classes: "bg-yellow-100 text-yellow-800",
    };
  };

  const systemStatus = getSystemStatus();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {controller.name}
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${systemStatus.classes}`}
        >
          {systemStatus.label}
        </span>
      </div>

      {controller.sprinklers?.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Irrigatori</h4>
          <div className="space-y-3">
            {controller.sprinklers.map((sprinkler) => (
              <div
                key={sprinkler.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <span className="text-sm text-gray-700">{sprinkler.name}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm ${
                      sprinkler.status ? "text-green-600" : "text-gray-500"
                    }`}
                  >
                    {sprinkler.status
                      ? `Attivo (${sprinkler.duration}m)`
                      : "Inattivo"}
                  </span>
                  <select
                    value={selectedDurations[sprinkler.id] || 5}
                    onChange={(e) =>
                      setSelectedDurations({
                        ...selectedDurations,
                        [sprinkler.id]: Number(e.target.value),
                      })
                    }
                    className="block rounded-md border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
                    disabled={!controller.status}
                  >
                    <option value={1}>1 minuto</option>
                    <option value={5}>5 minuti</option>
                    <option value={10}>10 minuti</option>
                    <option value={30}>30 minuti</option>
                    <option value={60}>60 minuti</option>
                  </select>
                  <button
                    onClick={() => handleStart(sprinkler.id)}
                    disabled={!controller.status || sprinkler.status}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Avvia
                  </button>
                  <button
                    onClick={() => handleStop(sprinkler.id)}
                    disabled={!controller.status || !sprinkler.status}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ControllerCard;
