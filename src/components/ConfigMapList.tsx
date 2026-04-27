import React, { useState, useEffect, useCallback } from "react";
import {
  FiRefreshCw,
  FiSearch,
  FiX,
  FiEdit2,
  FiSave,
  FiXCircle,
  FiChevronDown,
  FiChevronRight,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";
import { useClusterStore } from "../store/clusterStore";

const RefreshIcon     = FiRefreshCw    as React.ElementType;
const SearchIcon      = FiSearch       as React.ElementType;
const CloseIcon       = FiX            as React.ElementType;
const EditIcon        = FiEdit2        as React.ElementType;
const SaveIcon        = FiSave         as React.ElementType;
const CancelIcon      = FiXCircle      as React.ElementType;
const ChevDownIcon    = FiChevronDown  as React.ElementType;
const ChevRightIcon   = FiChevronRight as React.ElementType;
const AlertIcon       = FiAlertCircle  as React.ElementType;
const CheckIcon       = FiCheckCircle  as React.ElementType;

interface ConfigMap {
  name: string;
  namespace: string;
  data: Record<string, string>;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export const ConfigMapList: React.FC = () => {
  const { selectedCluster, selectedNamespace } = useClusterStore();

  const [configMaps, setConfigMaps] = useState<ConfigMap[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState(() => localStorage.getItem("cm-search") || "");

  // Which configmap is expanded
  const [expanded, setExpanded]     = useState<string | null>(null);

  // Editing state: configmapName -> edited key-value copy
  const [editing, setEditing]       = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving]         = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ name: string; ok: boolean; msg: string } | null>(null);

  const loadConfigMaps = useCallback(async () => {
    if (!selectedCluster || !selectedNamespace) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.getConfigMaps(selectedNamespace, selectedCluster.name);
      setConfigMaps(result);
    } catch (e: any) {
      setError(e?.message || "Error cargando ConfigMaps");
    } finally {
      setLoading(false);
    }
  }, [selectedCluster, selectedNamespace]);

  useEffect(() => {
    setConfigMaps([]);
    setExpanded(null);
    setEditing({});
    loadConfigMaps();
  }, [selectedCluster, selectedNamespace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem("cm-search", search);
  }, [search]);

  const filtered = configMaps.filter((cm) =>
    cm.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const startEdit = (cm: ConfigMap) => {
    setEditing((prev) => ({ ...prev, [cm.name]: { ...cm.data } }));
  };

  const cancelEdit = (name: string) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const updateKey = (cmName: string, key: string, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [cmName]: { ...prev[cmName], [key]: value },
    }));
  };

  const addKey = (cmName: string) => {
    setEditing((prev) => ({
      ...prev,
      [cmName]: { ...prev[cmName], "nueva-clave": "" },
    }));
  };

  const removeKey = (cmName: string, key: string) => {
    setEditing((prev) => {
      const copy = { ...prev[cmName] };
      delete copy[key];
      return { ...prev, [cmName]: copy };
    });
  };

  const saveEdit = async (cmName: string) => {
    if (!selectedCluster || !selectedNamespace) return;
    setSaving(cmName);
    setSaveStatus(null);
    try {
      await window.api.updateConfigMap(
        selectedNamespace,
        cmName,
        editing[cmName],
        selectedCluster.name
      );
      // Update local state
      setConfigMaps((prev) =>
        prev.map((cm) =>
          cm.name === cmName ? { ...cm, data: { ...editing[cmName] } } : cm
        )
      );
      cancelEdit(cmName);
      setSaveStatus({ name: cmName, ok: true, msg: "Guardado correctamente" });
    } catch (e: any) {
      setSaveStatus({ name: cmName, ok: false, msg: e?.message || "Error guardando" });
    } finally {
      setSaving(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!selectedCluster || !selectedNamespace) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Selecciona un cluster y namespace para ver los Config Maps.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <span className="text-sm font-semibold text-gray-700">
          Config Maps en{" "}
          <span className="text-blue-600">{selectedNamespace}</span>
          {!loading && (
            <span className="ml-2 text-gray-400 font-normal">
              ({filtered.length} de {configMaps.length})
            </span>
          )}
        </span>

        <div className="relative ml-auto w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar config map..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={loadConfigMaps}
          disabled={loading}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Recargar"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="px-4 pt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm pt-10">
              {search ? "Sin resultados para la búsqueda." : "No hay Config Maps en este namespace."}
            </p>
          )}

          {filtered.map((cm) => {
            const isExpanded = expanded === cm.name;
            const isEditing  = cm.name in editing;
            const isSaving   = saving === cm.name;
            const editData   = editing[cm.name] ?? cm.data;
            const status     = saveStatus?.name === cm.name ? saveStatus : null;
            const keyCount   = Object.keys(cm.data).length;

            return (
              <div
                key={cm.name}
                className={`border rounded-lg bg-white shadow-sm transition-all ${
                  isExpanded ? "border-blue-300" : "border-gray-200"
                }`}
              >
                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-lg"
                  onClick={() => setExpanded(isExpanded ? null : cm.name)}
                >
                  <span className="text-gray-400">
                    {isExpanded
                      ? <ChevDownIcon className="w-4 h-4" />
                      : <ChevRightIcon className="w-4 h-4" />}
                  </span>
                  <span className="font-medium text-gray-800 flex-1 text-sm">{cm.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {keyCount} {keyCount === 1 ? "clave" : "claves"}
                  </span>
                  {cm.creationTimestamp && (
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {new Date(cm.creationTimestamp).toLocaleDateString()}
                    </span>
                  )}
                  {!isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(cm); setExpanded(cm.name); }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Editar"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    {/* Save status notification */}
                    {status && (
                      <div
                        className={`flex items-center gap-2 text-sm mb-3 p-2 rounded-lg ${
                          status.ok
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {status.ok
                          ? <CheckIcon className="w-4 h-4 flex-shrink-0" />
                          : <AlertIcon className="w-4 h-4 flex-shrink-0" />}
                        {status.msg}
                      </div>
                    )}

                    {/* Table header */}
                    <div className="grid grid-cols-2 gap-2 mb-1 px-1">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clave</span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</span>
                    </div>

                    {/* Data rows */}
                    <div className="space-y-1.5">
                      {Object.entries(isEditing ? editData : cm.data).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-2 gap-2 items-start">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                defaultValue={key}
                                onBlur={(e) => {
                                  const newKey = e.target.value.trim();
                                  if (newKey && newKey !== key) {
                                    const copy = { ...editing[cm.name] };
                                    const val  = copy[key];
                                    delete copy[key];
                                    copy[newKey] = val;
                                    setEditing((prev) => ({ ...prev, [cm.name]: copy }));
                                  }
                                }}
                                className="px-2 py-1 text-sm border border-gray-300 rounded font-mono bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <div className="flex gap-1">
                                <textarea
                                  rows={1}
                                  value={value}
                                  onChange={(e) => updateKey(cm.name, key, e.target.value)}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                                />
                                <button
                                  onClick={() => removeKey(cm.name, key)}
                                  className="p-1 text-red-400 hover:text-red-600 flex-shrink-0"
                                  title="Eliminar clave"
                                >
                                  <CloseIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="px-2 py-1 text-sm font-mono text-gray-700 bg-gray-50 rounded border border-gray-100 break-all">
                                {key}
                              </span>
                              <span className="px-2 py-1 text-sm font-mono text-gray-600 bg-gray-50 rounded border border-gray-100 break-all whitespace-pre-wrap">
                                {value}
                              </span>
                            </>
                          )}
                        </div>
                      ))}

                      {Object.keys(isEditing ? editData : cm.data).length === 0 && (
                        <p className="text-xs text-gray-400 italic px-1">Sin datos</p>
                      )}
                    </div>

                    {/* Edit action buttons */}
                    {isEditing && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => addKey(cm.name)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Añadir clave
                        </button>
                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={() => cancelEdit(cm.name)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            <CancelIcon className="w-4 h-4" /> Cancelar
                          </button>
                          <button
                            onClick={() => saveEdit(cm.name)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <SaveIcon className={`w-4 h-4 ${isSaving ? "animate-pulse" : ""}`} />
                            {isSaving ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
