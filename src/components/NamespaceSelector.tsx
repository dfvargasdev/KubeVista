import React, { useState, useEffect, useRef } from "react";
import { useClusterStore } from "../store/clusterStore";
import { FiRefreshCw, FiSearch } from "react-icons/fi";

const RefreshIcon = FiRefreshCw as React.ElementType;
const SearchIcon = FiSearch as React.ElementType;

const HISTORY_KEY = "ns-history";
const LAST_NS_KEY = "last-selected-namespace";
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveToHistory(ns: string): void {
  const prev = loadHistory().filter((n) => n !== ns);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([ns, ...prev].slice(0, MAX_HISTORY)));
  localStorage.setItem(LAST_NS_KEY, ns);
}

function loadLastNamespace(): string | null {
  try {
    return localStorage.getItem(LAST_NS_KEY);
  } catch {
    return null;
  }
}

export const NamespaceSelector: React.FC = () => {
  const {
    selectedCluster,
    namespaces,
    selectedNamespace,
    setNamespaces,
    setSelectedNamespace,
    setLoading,
    setError,
  } = useClusterStore();

  const [manualInput, setManualInput] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const appliedManualNsRef = useRef(false);

  useEffect(() => {
    if (selectedCluster) {
      setManualInput("");
      setUseManual(false);
      appliedManualNsRef.current = false;
      loadNamespaces();
    }
  }, [selectedCluster]);

  useEffect(() => {
    // Cuando los namespaces cargan exitosamente y no hay namespace seleccionado
    if (!useManual && namespaces.length > 0 && !selectedNamespace) {
      const lastNs = loadLastNamespace();
      // Si existe un último namespace guardado y está en la lista, usarlo
      if (lastNs && namespaces.some((n) => n.name === lastNs)) {
        setSelectedNamespace(lastNs);
      } else {
        // Si no, usar el primero
        setSelectedNamespace(namespaces[0].name);
      }
    }
  }, [namespaces, useManual]);

  useEffect(() => {
    // Cuando falla la carga automática, pre-rellenar y aplicar automáticamente el último namespace
    if (useManual && !appliedManualNsRef.current) {
      const lastNs = loadLastNamespace();
      if (lastNs) {
        setManualInput(lastNs);
        setSelectedNamespace(lastNs);
        appliedManualNsRef.current = true;
      }
    }
  }, [useManual, setSelectedNamespace]);

  const loadNamespaces = async () => {
    if (!selectedCluster) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.api.getNamespaces(selectedCluster.name);
      setNamespaces(result);
      setUseManual(false);
      if (result.length > 0 && !selectedNamespace) {
        setSelectedNamespace(result[0].name);
      }
    } catch (error) {
      setNamespaces([]);
      setSelectedNamespace(null);
      setUseManual(true);
      setError(
        (error instanceof Error ? error.message : "Error loading namespaces") +
          " — Puedes escribir el nombre del namespace manualmente."
      );
      console.error("Error loading namespaces:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyManualNamespace = () => {
    const ns = manualInput.trim();
    if (!ns) return;
    setSelectedNamespace(ns);
    setError(null);
    saveToHistory(ns);
    setHistory(loadHistory());
  };

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") applyManualNamespace();
  };

  if (!selectedCluster) {
    return (
      <div className="px-4 py-2 text-gray-500">Select a cluster first</div>
    );
  }

  if (useManual) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            list="ns-history-list"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={handleManualKeyDown}
            placeholder="Escribe el namespace..."
            className="px-3 py-2 border border-yellow-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500 w-56"
            autoFocus
          />
          <datalist id="ns-history-list">
            {history.map((ns) => (
              <option key={ns} value={ns} />
            ))}
          </datalist>
        </div>
        <button
          onClick={applyManualNamespace}
          disabled={!manualInput.trim()}
          className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-40"
          title="Aplicar namespace"
        >
          <SearchIcon className="w-4 h-4" />
        </button>
        <button
          onClick={loadNamespaces}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Reintentar carga automática"
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
        {selectedNamespace && (
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Activo: <strong>{selectedNamespace}</strong>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedNamespace || ""}
        onChange={(e) => {
          setSelectedNamespace(e.target.value);
          saveToHistory(e.target.value);
        }}
        className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {namespaces.map((ns) => (
          <option key={ns.name} value={ns.name}>
            {ns.name}
          </option>
        ))}
      </select>

      <button
        onClick={() => setUseManual(true)}
        className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        title="Escribir namespace manualmente"
      >
        Manual
      </button>

      <button
        onClick={loadNamespaces}
        className="p-2 hover:bg-gray-100 rounded-lg transition"
        title="Refresh namespaces"
      >
        <RefreshIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
