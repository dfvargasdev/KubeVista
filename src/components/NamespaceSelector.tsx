import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useClusterStore } from "../store/clusterStore";
import { addUniqueValue } from "../services/selectionFilters";
import { FiPlus, FiRefreshCw, FiX } from "react-icons/fi";

const AddIcon = FiPlus as React.ElementType;
const RefreshIcon = FiRefreshCw as React.ElementType;
const CloseIcon = FiX as React.ElementType;

const HISTORY_KEY = "ns-history";
const LAST_NS_KEY = "last-selected-namespace";
const LAST_NS_BY_CLUSTER_KEY = "last-selected-namespace-by-cluster";
const SELECTED_NS_BY_CLUSTER_KEY = "selected-namespaces-by-cluster";
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function loadSavedNamespaces(clusterName?: string): string[] {
  try {
    if (clusterName) {
      const selectedMap = JSON.parse(
        localStorage.getItem(SELECTED_NS_BY_CLUSTER_KEY) || "{}"
      ) as Record<string, unknown>;
      const selected = selectedMap[clusterName];
      if (Array.isArray(selected)) {
        return selected.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
      }

      const lastMap = JSON.parse(
        localStorage.getItem(LAST_NS_BY_CLUSTER_KEY) || "{}"
      ) as Record<string, string>;
      if (lastMap[clusterName]) {
        return [lastMap[clusterName]];
      }
    }

    const lastNamespace = localStorage.getItem(LAST_NS_KEY);
    return lastNamespace ? [lastNamespace] : [];
  } catch {
    return [];
  }
}

function saveNamespaces(namespaces: string[], clusterName?: string): void {
  if (!clusterName) return;

  try {
    const selectedMap = JSON.parse(
      localStorage.getItem(SELECTED_NS_BY_CLUSTER_KEY) || "{}"
    ) as Record<string, string[]>;
    selectedMap[clusterName] = namespaces;
    localStorage.setItem(SELECTED_NS_BY_CLUSTER_KEY, JSON.stringify(selectedMap));

    const activeNamespace = namespaces[namespaces.length - 1];
    if (activeNamespace) {
      const lastMap = JSON.parse(
        localStorage.getItem(LAST_NS_BY_CLUSTER_KEY) || "{}"
      ) as Record<string, string>;
      lastMap[clusterName] = activeNamespace;
      localStorage.setItem(LAST_NS_BY_CLUSTER_KEY, JSON.stringify(lastMap));
      localStorage.setItem(LAST_NS_KEY, activeNamespace);
    }
  } catch {
    // Persistence is a convenience; an unavailable localStorage must not block navigation.
  }
}

function saveToHistory(namespace: string): string[] {
  const next = [namespace, ...loadHistory().filter((item) => item !== namespace)].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory history when localStorage is unavailable.
  }
  return next;
}

export const NamespaceSelector: React.FC = () => {
  const {
    selectedCluster,
    namespaces,
    selectedNamespaces,
    setNamespaces,
    setSelectedNamespaces,
    setLoading,
    setError,
  } = useClusterStore();

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>(loadHistory);

  const loadNamespaces = useCallback(async () => {
    if (!selectedCluster) return;

    setLoading(true);
    setError(null);
    try {
      const result = await window.api.getNamespaces(selectedCluster.name);
      setNamespaces(result);

      const currentSelection = useClusterStore.getState().selectedNamespaces;
      if (currentSelection.length === 0 && result.length > 0) {
        const nextSelection = [result[0].name];
        setSelectedNamespaces(nextSelection);
        saveNamespaces(nextSelection, selectedCluster.name);
      }
    } catch (error) {
      setNamespaces([]);
      const currentSelection = useClusterStore.getState().selectedNamespaces;
      if (currentSelection.length === 0) {
        setError(
          `${error instanceof Error ? error.message : "Error loading namespaces"} - ` +
          "Puedes escribir los namespaces manualmente."
        );
      }
      console.error("Error loading namespaces:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCluster, setError, setLoading, setNamespaces, setSelectedNamespaces]);

  useEffect(() => {
    if (!selectedCluster) {
      setSelectedNamespaces([]);
      setNamespaces([]);
      return;
    }

    const savedNamespaces = loadSavedNamespaces(selectedCluster.name);
    setInput("");
    setSelectedNamespaces(savedNamespaces);
    void loadNamespaces();
  }, [selectedCluster, loadNamespaces, setNamespaces, setSelectedNamespaces]);

  const suggestions = useMemo(() => {
    const known = namespaces.map((namespace) => namespace.name);
    return Array.from(new Set([...known, ...history])).filter(
      (namespace) => !selectedNamespaces.includes(namespace)
    );
  }, [history, namespaces, selectedNamespaces]);

  const addNamespace = () => {
    if (!selectedCluster) return;

    const nextSelection = addUniqueValue(selectedNamespaces, input);
    if (nextSelection === selectedNamespaces) return;

    const namespace = input.trim();
    setSelectedNamespaces(nextSelection);
    saveNamespaces(nextSelection, selectedCluster.name);
    setHistory(saveToHistory(namespace));
    setInput("");
    setError(null);
  };

  const removeNamespace = (namespace: string) => {
    if (!selectedCluster) return;

    const nextSelection = selectedNamespaces.filter((item) => item !== namespace);
    setSelectedNamespaces(nextSelection);
    saveNamespaces(nextSelection, selectedCluster.name);
  };

  if (!selectedCluster) {
    return <div className="px-4 py-2 text-gray-500">Selecciona primero un cluster</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative w-full sm:w-2/5 min-w-[14rem] flex-none">
          <input
            type="text"
            list="namespace-suggestions"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addNamespace();
              }
            }}
            placeholder="Escribe y agrega un namespace..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="namespace-suggestions">
            {suggestions.map((namespace) => (
              <option key={namespace} value={namespace} />
            ))}
          </datalist>
        </div>
        <button
          type="button"
          onClick={addNamespace}
          disabled={!input.trim()}
          className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition disabled:opacity-40"
          title="Agregar namespace"
        >
          <AddIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => void loadNamespaces()}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Actualizar namespaces"
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 min-h-[1.75rem]">
        {selectedNamespaces.length === 0 ? (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            Agrega al menos un namespace para consultar pods.
          </span>
        ) : (
          selectedNamespaces.map((namespace, index) => (
            <span
              key={namespace}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                index === selectedNamespaces.length - 1
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
              title={index === selectedNamespaces.length - 1
                ? "Namespace activo para Config Maps"
                : "Namespace incluido en la consulta de pods"}
            >
              {namespace}
              <button
                type="button"
                onClick={() => removeNamespace(namespace)}
                className="rounded-full p-0.5 hover:bg-black hover:bg-opacity-10"
                title={`Quitar ${namespace}`}
                aria-label={`Quitar namespace ${namespace}`}
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
};
