import React, { useState } from "react";

const ControllerCard = ({
  controller,
  onStartIrrigation,
  onStopIrrigation,
}) => {
  const [duration, setDuration] = useState(5);

  const handleStart = () => {
    onStartIrrigation(controller.id, duration);
  };

  const handleStop = () => {
    onStopIrrigation(controller.id);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {controller.name}
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            controller.status
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {controller.status ? "Online" : "Offline"}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="block rounded-md border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value={1}>1 minuto</option>
          <option value={5}>5 minuti</option>
          <option value={10}>10 minuti</option>
          <option value={30}>30 minuti</option>
          <option value={60}>60 minuti</option>
        </select>
        <button
          onClick={handleStart}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Avvia
        </button>
        <button
          onClick={handleStop}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Stop
        </button>
      </div>
      {controller.sprinklers?.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Irrigatori</h4>
          <div className="grid grid-cols-2 gap-3">
            {controller.sprinklers.map((sprinkler) => (
              <div
                key={sprinkler.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
              >
                <span className="text-sm text-gray-700">{sprinkler.name}</span>
                <span
                  className={`text-sm ${
                    sprinkler.status ? "text-green-600" : "text-gray-500"
                  }`}
                >
                  {sprinkler.status
                    ? `Attivo (${sprinkler.duration}m)`
                    : "Inattivo"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ControllerCard;
