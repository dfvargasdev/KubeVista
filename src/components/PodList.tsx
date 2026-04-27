import React, { useState, useEffect } from "react";
import { useClusterStore } from "../store/clusterStore";
import { FiTrash2, FiRefreshCw, FiFileText, FiSearch, FiX, FiDownload } from "react-icons/fi";

const RefreshIcon = FiRefreshCw as React.ElementType;
const FileTextIcon = FiFileText as React.ElementType;
const TrashIcon = FiTrash2 as React.ElementType;
const SearchIcon = FiSearch as React.ElementType;
const CloseIcon = FiX as React.ElementType;
const DownloadIcon = FiDownload as React.ElementType;

const SEARCH_KEY = "pod-search-filter";

function loadSearchFilter(): string {
  try {
    return localStorage.getItem(SEARCH_KEY) || "";
  } catch {
    return "";
  }
}

function saveSearchFilter(search: string): void {
  try {
    localStorage.setItem(SEARCH_KEY, search);
  } catch {}
}

interface RecoveryState {
  progress: number;
  message: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getWorkloadPrefix(podName: string): string {
  const parts = podName.split("-");
  if (parts.length > 2) {
    return parts.slice(0, -2).join("-");
  }
  return podName;
}

export const PodList: React.FC = () => {
  const { selectedCluster, selectedNamespace, pods, setPods, setLoading, setError } = useClusterStore();
  const [expandedPod, setExpandedPod] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [logErrors, setLogErrors] = useState<Record<string, string>>({});
  const [recoveries, setRecoveries] = useState<Record<string, RecoveryState>>({});
  const [search, setSearch] = useState(loadSearchFilter);
  const [expandedLogPod, setExpandedLogPod] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCluster && selectedNamespace) {
      loadPods();
    }
  }, [selectedCluster, selectedNamespace]);

  useEffect(() => {
    saveSearchFilter(search);
  }, [search]);

  const loadPods = async () => {
    if (!selectedCluster || !selectedNamespace) return;

    setLoading(true);
    setError(null);
    setPods([]);
    try {
      const result = await window.api.getPods(selectedNamespace, selectedCluster.name);
      setPods(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error loading pods");
      console.error("Error loading pods:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "Running":
        return "bg-green-100 text-green-800";
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleViewLogs = async (podName: string) => {
    if (!selectedCluster || !selectedNamespace) return;

    setLoading(true);
    setLogErrors((prev) => ({ ...prev, [podName]: "" }));
    try {
      const podLogs = await window.api.getPodLogs(
        selectedNamespace,
        podName,
        selectedCluster.name
      );
      setLogs((prev) => ({ ...prev, [podName]: podLogs }));
      setLogErrors((prev) => ({ ...prev, [podName]: "" }));
      setExpandedPod(expandedPod === podName ? null : podName);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error loading logs";
      setLogErrors((prev) => ({ ...prev, [podName]: errorMsg }));
      setLogs((prev) => ({ ...prev, [podName]: "" }));
      setError(errorMsg);
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = (podName: string) => {
    const content = logs[podName];
    if (!content) {
      setError("No hay logs cargados para descargar.");
      return;
    }

    const now = new Date();
    const safeTs = now.toISOString().replace(/[:.]/g, "-");
    const filename = `${podName}-${safeTs}.log`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const monitorRecovery = async (
    workloadPrefix: string,
    deletedPodName: string,
    namespace: string,
    clusterName: string
  ) => {
    const timeoutMs = 120000;
    const intervalMs = 2500;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await delay(intervalMs);

      try {
        const currentPods = await window.api.getPods(namespace, clusterName);
        setPods(currentPods);

        const deletedStillExists = currentPods.some((p: any) => p.name === deletedPodName);
        const relatedPods = currentPods.filter((p: any) => p.name.startsWith(`${workloadPrefix}-`));
        const runningRelated = relatedPods.filter((p: any) => p.status === "Running").length;
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(95, 20 + Math.floor((elapsed / timeoutMs) * 70));

        if (!deletedStillExists && runningRelated > 0) {
          setRecoveries((prev) => ({
            ...prev,
            [workloadPrefix]: {
              progress: 100,
              message: `Restablecido (${runningRelated} pod(s) running).`,
            },
          }));

          setTimeout(() => {
            setRecoveries((prev) => {
              const next = { ...prev };
              delete next[workloadPrefix];
              return next;
            });
          }, 3000);

          return;
        }

        let message = "Esperando restablecimiento...";
        if (deletedStillExists) {
          message = "Terminando pod antiguo...";
        } else if (relatedPods.length === 0) {
          message = "Creando nuevo pod...";
        } else if (runningRelated === 0) {
          message = "Inicializando contenedor...";
        }

        setRecoveries((prev) => ({
          ...prev,
          [workloadPrefix]: { progress, message },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error monitoreando restablecimiento";
        setRecoveries((prev) => ({
          ...prev,
          [workloadPrefix]: { progress: 100, message },
        }));
        return;
      }
    }

    setRecoveries((prev) => ({
      ...prev,
      [workloadPrefix]: {
        progress: 100,
        message: "Tiempo de espera agotado. Revisa el estado del deployment.",
      },
    }));
  };

  const handleDeletePod = async (podName: string) => {
    if (!selectedCluster || !selectedNamespace) return;

    const workloadPrefix = getWorkloadPrefix(podName);
    const clusterName = selectedCluster.name;
    const namespace = selectedNamespace;

    const confirmed = window.confirm(`Eliminar pod ${podName}? Kubernetes lo recreara automaticamente.`);
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setRecoveries((prev) => ({
      ...prev,
      [workloadPrefix]: { progress: 10, message: "Eliminando pod..." },
    }));

    try {
      await window.api.deletePod(namespace, podName, clusterName);
      setRecoveries((prev) => ({
        ...prev,
        [workloadPrefix]: { progress: 20, message: "Pod eliminado. Iniciando restablecimiento..." },
      }));

      void monitorRecovery(workloadPrefix, podName, namespace, clusterName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error deleting pod";
      setError(message);
      setRecoveries((prev) => ({
        ...prev,
        [workloadPrefix]: { progress: 100, message },
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCluster || !selectedNamespace) {
    return (
      <div className="p-8 text-center text-gray-500">
        Select a cluster and namespace to view pods
      </div>
    );
  }

  const filteredPods = pods.filter((pod) =>
    pod.name.toLowerCase().includes(search.toLowerCase())
  );

  const activeRecoveries = Object.entries(recoveries);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header con buscador */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold whitespace-nowrap">
          Pods en <span className="text-blue-600">{selectedNamespace}</span>
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({filteredPods.length}{search ? ` de ${pods.length}` : ""})
          </span>
        </h2>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar pods..."
              className="w-full pl-8 pr-9 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>
        <button
          onClick={loadPods}
          className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition"
          title="Refresh pods"
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Lista scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeRecoveries.length > 0 && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 space-y-2">
            {activeRecoveries.map(([workload, state]) => (
              <div key={workload}>
                <div className="flex items-center justify-between text-xs text-amber-900 mb-1">
                  <span className="font-semibold">{workload}</span>
                  <span>{state.message}</span>
                </div>
                <div className="w-full h-2 bg-amber-100 rounded">
                  <div
                    className="h-2 bg-amber-500 rounded transition-all duration-500"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredPods.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {pods.length === 0 ? "No pods found in this namespace" : "No hay pods que coincidan con el filtro"}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {/* Encabezados de columnas */}
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-4 text-sm font-semibold text-gray-700">
              <div className="flex-1 min-w-0">Name</div>
              <div className="w-20">Status</div>
              <div className="w-16">CPU</div>
              <div className="w-20">Memory</div>
              <div className="w-16">Restarts</div>
              <div className="w-12">Age</div>
              <div className="w-20">Actions</div>
            </div>

            {filteredPods.map((pod) => (
              <div key={pod.name} className="bg-white hover:bg-gray-50 transition border-b border-gray-200">
                <div className="px-4 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate text-sm" title={pod.name}>{pod.name}</h3>
                    <p className="text-xs text-gray-500 truncate">Image: {pod.image}</p>
                  </div>
                  <div className="w-20">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                        pod.status
                      )}`}
                    >
                      {pod.status}
                    </span>
                  </div>
                  <div className="w-16 text-sm text-gray-700">{pod.cpu || "-"}</div>
                  <div className="w-20 text-sm text-gray-700">{pod.memory || "-"}</div>
                  <div className="w-16 text-sm font-medium text-gray-900">{pod.restarts}</div>
                  <div className="w-12 text-sm text-gray-600">{pod.age || "-"}</div>
                  <div className="w-20 flex items-center gap-2">
                    <button
                      onClick={() => handleViewLogs(pod.name)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="View logs"
                    >
                      <FileTextIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadLogs(pod.name)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="Download logs"
                      disabled={!logs[pod.name]}
                    >
                      <DownloadIcon className={`w-4 h-4 ${logs[pod.name] ? "" : "text-gray-300"}`} />
                    </button>
                    <button
                      onClick={() => handleDeletePod(pod.name)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded transition"
                      title="Delete pod"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedPod === pod.name && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4 max-h-64 overflow-hidden flex flex-col">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Logs:</h4>
                    {logErrors[pod.name] ? (
                      <pre className="flex-1 text-xs bg-red-50 p-3 rounded border border-red-200 text-red-700 font-mono overflow-auto">
                        {logErrors[pod.name]}
                      </pre>
                    ) : logs[pod.name] ? (
                      <pre className="flex-1 text-xs bg-white p-3 rounded border border-gray-200 overflow-auto text-gray-700 font-mono">
                        {logs[pod.name]}
                      </pre>
                    ) : (
                      <pre className="flex-1 text-xs bg-blue-50 p-3 rounded border border-blue-200 text-blue-700 font-mono">
                        Cargando logs...
                      </pre>
                    )}
                    {logs[pod.name] && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => setExpandedLogPod(pod.name)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                        >
                          Expandir logs →
                        </button>
                        <button
                          onClick={() => downloadLogs(pod.name)}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                        >
                          Descargar logs
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de logs expandidos */}
      {expandedLogPod && logs[expandedLogPod] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-96 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Logs: {expandedLogPod}</h3>
              <button
                onClick={() => setExpandedLogPod(null)}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto text-xs bg-gray-900 text-green-400 p-4 font-mono whitespace-pre-wrap break-words">
              {logs[expandedLogPod]}
            </pre>
            <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => downloadLogs(expandedLogPod)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition mr-2"
              >
                Descargar logs
              </button>
              <button
                onClick={() => setExpandedLogPod(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
