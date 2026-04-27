import React, { useState, useEffect, useRef, useCallback } from "react";
import { useClusterStore } from "../store/clusterStore";
import { FiTrash2, FiRefreshCw, FiFileText, FiSearch, FiX, FiDownload, FiTerminal, FiCopy, FiCheck } from "react-icons/fi";

const RefreshIcon = FiRefreshCw as React.ElementType;
const FileTextIcon = FiFileText as React.ElementType;
const TrashIcon = FiTrash2 as React.ElementType;
const SearchIcon = FiSearch as React.ElementType;
const CloseIcon = FiX as React.ElementType;
const DownloadIcon = FiDownload as React.ElementType;
const TerminalIcon = FiTerminal as React.ElementType;
const CopyIcon = FiCopy as React.ElementType;
const CheckIcon = FiCheck as React.ElementType;

const SEARCH_KEY = "pod-search-filter";
const PODS_REFRESH_INTERVAL_MS = 10000;
const LOGS_REFRESH_INTERVAL_MS = 5000;
const SCROLL_BOTTOM_THRESHOLD_PX = 32;

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

function deriveServiceNameFromPod(podName: string): string {
  // Typical deployment pod name: deployment-my-app-7f8c9d4b6f-abcde
  // Desired service: service-my-app
  const match = podName.match(/^(deployment)-(.*)-[a-z0-9]{8,10}-[a-z0-9]{5}$/i);
  if (match?.[2]) {
    return `service-${match[2]}`;
  }

  if (podName.startsWith("deployment-")) {
    return `service-${getWorkloadPrefix(podName).replace(/^deployment-/, "")}`;
  }

  return podName;
}

function buildServiceFqdn(podName: string, namespace: string): string {
  return `${deriveServiceNameFromPod(podName)}.${namespace}.svc.cluster.local`;
}

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX;
}

function scrollToBottomIfNeeded(element: HTMLElement | null, force = false): void {
  if (!element) return;
  if (force || isNearBottom(element)) {
    element.scrollTop = element.scrollHeight;
  }
}

export const PodList: React.FC = () => {
  const { selectedCluster, selectedNamespace, pods, setPods, setLoading, setError } = useClusterStore();
  const [expandedPod, setExpandedPod] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [logErrors, setLogErrors] = useState<Record<string, string>>({});
  const [recoveries, setRecoveries] = useState<Record<string, RecoveryState>>({});
  const [search, setSearch] = useState(loadSearchFilter);
  const [expandedLogPod, setExpandedLogPod] = useState<string | null>(null);
  const [terminalPod, setTerminalPod] = useState<string | null>(null);
  const [terminalContainers, setTerminalContainers] = useState<string[]>([]);
  const [terminalContainer, setTerminalContainer] = useState<string>("");
  const [terminalCommand, setTerminalCommand] = useState<string>("");
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [terminalRunning, setTerminalRunning] = useState<boolean>(false);
  const [copiedServiceForPod, setCopiedServiceForPod] = useState<string | null>(null);
  const [copiedServiceValue, setCopiedServiceValue] = useState<string | null>(null);
  const [selectedPods, setSelectedPods] = useState<Set<string>>(new Set());
  const inlineLogsRef = useRef<HTMLPreElement | null>(null);
  const expandedLogsRef = useRef<HTMLPreElement | null>(null);

  const loadPods = useCallback(async (isBackground = false) => {
    if (!selectedCluster || !selectedNamespace) return;

    if (!isBackground) {
      setLoading(true);
      setError(null);
      setPods([]);
    }

    try {
      const result = await window.api.getPods(selectedNamespace, selectedCluster.name);
      setPods(result);
    } catch (error) {
      if (!isBackground) {
        setError(error instanceof Error ? error.message : "Error loading pods");
      }
      console.error("Error loading pods:", error);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [selectedCluster, selectedNamespace, setError, setLoading, setPods]);

  const fetchPodLogs = useCallback(async (podName: string, isBackground = false) => {
    if (!selectedCluster || !selectedNamespace) return;

    if (!isBackground) {
      setLoading(true);
      setLogErrors((prev) => ({ ...prev, [podName]: "" }));
    }

    try {
      const podLogs = await window.api.getPodLogs(
        selectedNamespace,
        podName,
        selectedCluster.name
      );
      setLogs((prev) => ({ ...prev, [podName]: podLogs }));
      setLogErrors((prev) => ({ ...prev, [podName]: "" }));

      requestAnimationFrame(() => {
        const force = !isBackground;
        if (expandedLogPod === podName) {
          scrollToBottomIfNeeded(expandedLogsRef.current, force);
        } else if (expandedPod === podName) {
          scrollToBottomIfNeeded(inlineLogsRef.current, force);
        }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error loading logs";
      setLogErrors((prev) => ({ ...prev, [podName]: errorMsg }));
      if (!isBackground) {
        setLogs((prev) => ({ ...prev, [podName]: "" }));
        setError(errorMsg);
      }
      console.error("Error loading logs:", error);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [selectedCluster, selectedNamespace, setError, setLoading, expandedLogPod, expandedPod]);

  useEffect(() => {
    if (selectedCluster && selectedNamespace) {
      setSelectedPods(new Set());
      void loadPods();
    }
  }, [selectedCluster, selectedNamespace, loadPods]);

  useEffect(() => {
    if (!selectedCluster || !selectedNamespace) return;
    const interval = setInterval(() => {
      void loadPods(true);
    }, PODS_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedCluster, selectedNamespace, loadPods]);

  useEffect(() => {
    // Keep selection only for pods that still exist in the current list.
    setSelectedPods((prev) => {
      if (prev.size === 0) return prev;
      const names = new Set(pods.map((p) => p.name));
      const next = new Set<string>();
      prev.forEach((name) => {
        if (names.has(name)) next.add(name);
      });
      return next;
    });
  }, [pods]);

  useEffect(() => {
    saveSearchFilter(search);
  }, [search]);

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

    if (expandedPod === podName) {
      setExpandedPod(null);
      return;
    }

    setExpandedPod(podName);
    await fetchPodLogs(podName, false);
  };

  useEffect(() => {
    if (!selectedCluster || !selectedNamespace) return;
    const activePodForLogs = expandedLogPod || expandedPod;
    if (!activePodForLogs) return;

    const interval = setInterval(() => {
      void fetchPodLogs(activePodForLogs, true);
    }, LOGS_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedCluster, selectedNamespace, expandedPod, expandedLogPod, fetchPodLogs]);

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

  const deletePodsBulk = async (podNames: string[]) => {
    if (!selectedCluster || !selectedNamespace || podNames.length === 0) return;

    const clusterName = selectedCluster.name;
    const namespace = selectedNamespace;

    const confirmed = window.confirm(
      `Eliminar ${podNames.length} pod(s)? Kubernetes los recreara automaticamente.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const failures: string[] = [];

    for (const podName of podNames) {
      const workloadPrefix = getWorkloadPrefix(podName);

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
        failures.push(`${podName}: ${message}`);
        setRecoveries((prev) => ({
          ...prev,
          [workloadPrefix]: { progress: 100, message },
        }));
      }
    }

    setSelectedPods(new Set());

    if (failures.length > 0) {
      setError(`Fallo al eliminar ${failures.length} pod(s). Revisa detalles en consola.`);
      console.error("Bulk delete failures:", failures);
    }

    setLoading(false);
  };

  const togglePodSelection = (podName: string) => {
    setSelectedPods((prev) => {
      const next = new Set(prev);
      if (next.has(podName)) {
        next.delete(podName);
      } else {
        next.add(podName);
      }
      return next;
    });
  };

  const openTerminal = async (podName: string) => {
    if (!selectedCluster || !selectedNamespace) return;

    setLoading(true);
    setError(null);
    try {
      const containers = await window.api.getPodContainers(
        selectedNamespace,
        podName,
        selectedCluster.name
      );

      setTerminalPod(podName);
      setTerminalContainers(containers);
      setTerminalContainer(containers[0] || "");
      setTerminalCommand("");
      setTerminalOutput(`# Terminal del pod ${podName}\n`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudieron cargar contenedores del pod");
    } finally {
      setLoading(false);
    }
  };

  const closeTerminal = () => {
    setTerminalPod(null);
    setTerminalContainers([]);
    setTerminalContainer("");
    setTerminalCommand("");
    setTerminalOutput("");
    setTerminalRunning(false);
  };

  const runTerminalCommand = async () => {
    if (!selectedCluster || !selectedNamespace || !terminalPod || !terminalContainer) return;
    const command = terminalCommand.trim();
    if (!command) return;

    setTerminalRunning(true);
    setTerminalOutput((prev) => `${prev}\n$ ${command}\n`);
    try {
      const result = await window.api.execPodCommand(
        selectedNamespace,
        terminalPod,
        terminalContainer,
        selectedCluster.name,
        command
      );

      const chunk = [result.stdout, result.stderr].filter(Boolean).join("\n");
      setTerminalOutput((prev) => `${prev}${chunk ? `${chunk}\n` : "(sin salida)\n"}`);
      setTerminalCommand("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error ejecutando comando";
      setTerminalOutput((prev) => `${prev}${message}\n`);
    } finally {
      setTerminalRunning(false);
    }
  };

  const copyServiceName = async (podName: string) => {
    if (!selectedNamespace) return;
    const serviceName = buildServiceFqdn(podName, selectedNamespace);
    try {
      await navigator.clipboard.writeText(serviceName);
      setCopiedServiceForPod(podName);
      setCopiedServiceValue(serviceName);
      setTimeout(() => setCopiedServiceForPod((prev) => (prev === podName ? null : prev)), 1400);
      setTimeout(() => setCopiedServiceValue((prev) => (prev === serviceName ? null : prev)), 1800);
    } catch {
      setError("No se pudo copiar al portapapeles");
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

  const allFilteredSelected =
    filteredPods.length > 0 && filteredPods.every((pod) => selectedPods.has(pod.name));

  const toggleSelectAllFiltered = () => {
    setSelectedPods((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredPods.forEach((pod) => next.delete(pod.name));
      } else {
        filteredPods.forEach((pod) => next.add(pod.name));
      }
      return next;
    });
  };

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
          onClick={() => void loadPods()}
          className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition"
          title="Refresh pods"
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => void deletePodsBulk(Array.from(selectedPods))}
          disabled={selectedPods.size === 0}
          className="flex-shrink-0 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          title="Eliminar pods seleccionados"
        >
          Eliminar seleccionados ({selectedPods.size})
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
              <div className="w-8 flex justify-center">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  title={allFilteredSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                />
              </div>
              <div className="flex-1 min-w-0">Name</div>
              <div className="w-20">Status</div>
              <div className="w-16">CPU</div>
              <div className="w-20">Memory</div>
              <div className="w-16">Restarts</div>
              <div className="w-12">Age</div>
              <div className="w-36">Actions</div>
            </div>

            {filteredPods.map((pod) => (
              <div key={pod.name} className="bg-white hover:bg-gray-50 transition border-b border-gray-200">
                <div className="px-4 py-4 flex items-center gap-4">
                  <div className="w-8 flex justify-center">
                    <input
                      type="checkbox"
                      checked={selectedPods.has(pod.name)}
                      onChange={() => togglePodSelection(pod.name)}
                      title={`Seleccionar ${pod.name}`}
                    />
                  </div>
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
                  <div className="w-36 flex items-center gap-2">
                    <button
                      onClick={() => void copyServiceName(pod.name)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title={`Copiar servicio: ${buildServiceFqdn(pod.name, selectedNamespace)}`}
                    >
                      {copiedServiceForPod === pod.name
                        ? <CheckIcon className="w-4 h-4 text-green-600" />
                        : <CopyIcon className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleViewLogs(pod.name)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="View logs"
                    >
                      <FileTextIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openTerminal(pod.name)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="Abrir terminal del pod"
                    >
                      <TerminalIcon className="w-4 h-4" />
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
                      <pre
                        ref={expandedPod === pod.name ? inlineLogsRef : null}
                        className="flex-1 text-xs bg-white p-3 rounded border border-gray-200 overflow-auto text-gray-700 font-mono"
                      >
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
                          onClick={() => {
                            setExpandedLogPod(pod.name);
                            requestAnimationFrame(() => scrollToBottomIfNeeded(expandedLogsRef.current, true));
                          }}
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
      {copiedServiceValue && (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
          <div className="max-w-[36rem] bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-gray-700">
            Servicio copiado: <span className="font-mono text-green-300">{copiedServiceValue}</span>
          </div>
        </div>
      )}

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
            <pre
              ref={expandedLogsRef}
              className="flex-1 overflow-auto text-xs bg-gray-900 text-green-400 p-4 font-mono whitespace-pre-wrap break-words"
            >
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

      {/* Modal terminal pod */}
      {terminalPod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Terminal: {terminalPod}</h3>
                <p className="text-xs text-gray-500">Namespace: {selectedNamespace}</p>
              </div>
              <button
                onClick={closeTerminal}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <label className="text-xs text-gray-600">Contenedor</label>
              <select
                value={terminalContainer}
                onChange={(e) => setTerminalContainer(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
              >
                {terminalContainers.map((container) => (
                  <option key={container} value={container}>{container}</option>
                ))}
              </select>
              <input
                type="text"
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !terminalRunning) {
                    void runTerminalCommand();
                  }
                }}
                placeholder="Escribe un comando (ej: printenv | grep REDIS)"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={terminalRunning}
              />
              <button
                onClick={() => void runTerminalCommand()}
                disabled={terminalRunning || !terminalCommand.trim() || !terminalContainer}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {terminalRunning ? "Ejecutando..." : "Ejecutar"}
              </button>
            </div>

            <pre className="flex-1 overflow-auto text-xs bg-gray-900 text-green-400 p-4 font-mono whitespace-pre-wrap break-words">
              {terminalOutput || "Terminal vacia."}
            </pre>

            <div className="border-t border-gray-200 p-3 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setTerminalOutput("")}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Limpiar salida
              </button>
              <button
                onClick={closeTerminal}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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
