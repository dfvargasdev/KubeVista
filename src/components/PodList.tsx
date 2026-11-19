import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useClusterStore } from "../store/clusterStore";
import type { Pod, PodPort } from "../services/kubernetesService";
import { getPreferredPortForwardPort } from "../services/podPorts";
import {
  addUniqueValue,
  deriveServiceNameFromPod,
  matchesAnyFilter,
} from "../services/selectionFilters";
import { FiTrash2, FiRefreshCw, FiFileText, FiSearch, FiX, FiDownload, FiTerminal, FiCopy, FiCheck, FiLayers, FiLink, FiExternalLink, FiStopCircle, FiPlus } from "react-icons/fi";

const RefreshIcon = FiRefreshCw as React.ElementType;
const FileTextIcon = FiFileText as React.ElementType;
const TrashIcon = FiTrash2 as React.ElementType;
const SearchIcon = FiSearch as React.ElementType;
const CloseIcon = FiX as React.ElementType;
const DownloadIcon = FiDownload as React.ElementType;
const TerminalIcon = FiTerminal as React.ElementType;
const CopyIcon = FiCopy as React.ElementType;
const CheckIcon = FiCheck as React.ElementType;
const ServiceLogsIcon = FiLayers as React.ElementType;
const LinkIcon = FiLink as React.ElementType;
const ExternalLinkIcon = FiExternalLink as React.ElementType;
const StopIcon = FiStopCircle as React.ElementType;
const AddIcon = FiPlus as React.ElementType;

const SEARCH_KEY = "pod-search-filter";
const POD_FILTERS_KEY = "pod-name-filters";
const PODS_REFRESH_INTERVAL_MS = 10000;
const LOGS_REFRESH_INTERVAL_MS = 5000;
const SCROLL_BOTTOM_THRESHOLD_PX = 32;
const RECOVERY_BANNER_TTL_MS = 12000;
const LOG_LINE_LIMIT_KEY = "pod-log-line-limit";
const PORT_FORWARD_REFRESH_INTERVAL_MS = 3000;
const DEFAULT_PORT_FORWARD_LOCAL_PORT = 8888;

type LogLineLimit = "500" | "2000" | "10000" | "all";

const LOG_LINE_LIMIT_OPTIONS: Array<{ value: LogLineLimit; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "500", label: "Ultimas 500" },
  { value: "2000", label: "Ultimas 2.000" },
  { value: "10000", label: "Ultimas 10.000" },
];

function loadSearchFilter(): string {
  try {
    return localStorage.getItem(SEARCH_KEY) || "";
  } catch {
    return "";
  }
}

function loadPodFilters(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(POD_FILTERS_KEY) || "[]");
    if (Array.isArray(parsed)) {
      return Array.from(new Set(
        parsed
          .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
          .map(deriveServiceNameFromPod)
      ));
    }
  } catch {
    // Fall back to the previous single-filter preference below.
  }

  const legacyFilter = loadSearchFilter().trim();
  return legacyFilter ? [deriveServiceNameFromPod(legacyFilter)] : [];
}

function savePodFilters(filters: string[]): void {
  try {
    localStorage.setItem(POD_FILTERS_KEY, JSON.stringify(filters));
    localStorage.removeItem(SEARCH_KEY);
  } catch {
    // Filtering still works when localStorage is unavailable.
  }
}

function loadLogLineLimit(): LogLineLimit {
  try {
    const stored = localStorage.getItem(LOG_LINE_LIMIT_KEY) as LogLineLimit | null;
    const isKnownValue = LOG_LINE_LIMIT_OPTIONS.some((option) => option.value === stored);
    return isKnownValue && stored ? stored : "all";
  } catch {
    return "all";
  }
}

function saveLogLineLimit(limit: LogLineLimit): void {
  try {
    localStorage.setItem(LOG_LINE_LIMIT_KEY, limit);
  } catch {}
}

function parseLogLineLimit(limit: LogLineLimit): number | undefined {
  if (limit === "all") {
    return undefined;
  }

  const parsed = Number.parseInt(limit, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countLogMatches(content: string, search: string): number {
  const query = search.trim();
  if (!query) {
    return 0;
  }

  const matches = content.match(new RegExp(escapeRegExp(query), "gi"));
  return matches?.length || 0;
}

function getVisibleLog(content: string, search: string, onlyMatching: boolean): string {
  const query = search.trim();
  if (!query || !onlyMatching) {
    return content;
  }

  const lowerQuery = query.toLowerCase();
  const matchingLines = content
    .split(/\r?\n/)
    .filter((line) => line.toLowerCase().includes(lowerQuery));

  return matchingLines.length > 0
    ? matchingLines.join("\n")
    : "No hay lineas que coincidan con la busqueda.";
}

interface HighlightedLogProps {
  content: string;
  search: string;
}

function HighlightedLog({ content, search }: HighlightedLogProps) {
  const parts = useMemo(() => {
    const query = search.trim();
    if (!query) {
      return [content];
    }
    return content.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  }, [content, search]);

  const query = search.trim().toLowerCase();
  if (!query) {
    return <>{content}</>;
  }

  return (
    <>
      {parts.map((part, index) => (
        part.toLowerCase() === query
          ? (
            <mark key={index} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">
              {part}
            </mark>
          )
          : <React.Fragment key={index}>{part}</React.Fragment>
      ))}
    </>
  );
}

interface LogSearchControlsProps {
  search: string;
  onlyMatching: boolean;
  matchCount: number;
  onSearchChange: (value: string) => void;
  onOnlyMatchingChange: (value: boolean) => void;
}

function LogSearchControls({
  search,
  onlyMatching,
  matchCount,
  onSearchChange,
  onOnlyMatchingChange,
}: LogSearchControlsProps) {
  const hasSearch = search.trim().length > 0;
  const matchText = hasSearch
    ? `${matchCount} coincidencia${matchCount === 1 ? "" : "s"}`
    : "Buscar dentro de logs";

  return (
    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 min-w-0">
        <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(event) => {
            const nextSearch = event.target.value;
            onSearchChange(nextSearch);
            if (!nextSearch.trim()) {
              onOnlyMatchingChange(false);
            }
          }}
          placeholder="Buscar en logs..."
          className="w-full pl-8 pr-9 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {hasSearch && (
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              onOnlyMatchingChange(false);
            }}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            title="Limpiar busqueda"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-600">
        <span className="whitespace-nowrap">{matchText}</span>
        <label className="flex items-center gap-1 whitespace-nowrap">
          <input
            type="checkbox"
            checked={onlyMatching}
            onChange={(event) => onOnlyMatchingChange(event.target.checked)}
            disabled={!hasSearch}
          />
          Solo coincidencias
        </label>
      </div>
    </div>
  );
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

function podPortKey(port: PodPort): string {
  return `${port.containerName}:${port.name || ""}:${port.port}:${port.protocol}`;
}

function podPortLabel(port: PodPort): string {
  const portName = port.name ? ` (${port.name})` : "";
  return `${port.containerName}: ${port.port}/${port.protocol}${portName}`;
}

function podKey(pod: Pick<Pod, "namespace" | "name">): string {
  return `${pod.namespace}/${pod.name}`;
}

function recoveryKey(pod: Pick<Pod, "namespace" | "name">): string {
  return `${pod.namespace}/${getWorkloadPrefix(pod.name)}`;
}

export const PodList: React.FC = () => {
  const {
    selectedCluster,
    selectedNamespaces,
    pods,
    setPods,
    setLoading,
    setError,
  } = useClusterStore();
  const [expandedPod, setExpandedPod] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [logErrors, setLogErrors] = useState<Record<string, string>>({});
  const [recoveries, setRecoveries] = useState<Record<string, RecoveryState>>({});
  const [search, setSearch] = useState("");
  const [podFilters, setPodFilters] = useState<string[]>(loadPodFilters);
  const [logLineLimit, setLogLineLimit] = useState<LogLineLimit>(loadLogLineLimit);
  const [logSearches, setLogSearches] = useState<Record<string, string>>({});
  const [onlyMatchingLogLines, setOnlyMatchingLogLines] = useState<Record<string, boolean>>({});
  const [expandedLogPod, setExpandedLogPod] = useState<string | null>(null);
  const [serviceLogsOpen, setServiceLogsOpen] = useState(false);
  const [serviceLogsResult, setServiceLogsResult] = useState<ServiceLogsResult | null>(null);
  const [serviceLogsLoading, setServiceLogsLoading] = useState(false);
  const [serviceLogsError, setServiceLogsError] = useState("");
  const [serviceLogsSearch, setServiceLogsSearch] = useState("");
  const [serviceLogsPod, setServiceLogsPod] = useState<Pod | null>(null);
  const [onlyMatchingServiceLogLines, setOnlyMatchingServiceLogLines] = useState(false);
  const [terminalPod, setTerminalPod] = useState<Pod | null>(null);
  const [terminalContainers, setTerminalContainers] = useState<string[]>([]);
  const [terminalContainer, setTerminalContainer] = useState<string>("");
  const [terminalCommand, setTerminalCommand] = useState<string>("");
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [terminalRunning, setTerminalRunning] = useState<boolean>(false);
  const [portForwardPod, setPortForwardPod] = useState<Pod | null>(null);
  const [portForwardPortKey, setPortForwardPortKey] = useState("");
  const [portForwardLocalPort, setPortForwardLocalPort] = useState("");
  const [portForwards, setPortForwards] = useState<PortForwardSession[]>([]);
  const [portForwardLoading, setPortForwardLoading] = useState(false);
  const [portForwardError, setPortForwardError] = useState("");
  const [copiedServiceForPod, setCopiedServiceForPod] = useState<string | null>(null);
  const [copiedServiceValue, setCopiedServiceValue] = useState<string | null>(null);
  const [selectedPods, setSelectedPods] = useState<Set<string>>(new Set());
  const inlineLogsRef = useRef<HTMLPreElement | null>(null);
  const expandedLogsRef = useRef<HTMLPreElement | null>(null);
  // Track which pod we last force-scrolled so we can distinguish
  // "first open" (force scroll to bottom) from "auto-refresh" (tail-follow).
  const lastScrolledInlinePodRef = useRef<string | null>(null);
  const lastScrolledModalPodRef = useRef<string | null>(null);

  const clearRecovery = useCallback((workloadPrefix: string) => {
    setRecoveries((prev) => {
      if (!prev[workloadPrefix]) return prev;
      const next = { ...prev };
      delete next[workloadPrefix];
      return next;
    });
  }, []);

  const loadPods = useCallback(async (isBackground = false) => {
    if (!selectedCluster || selectedNamespaces.length === 0) return;

    if (!isBackground) {
      setLoading(true);
      setError(null);
      setPods([]);
    }

    try {
      const results = await Promise.allSettled(
        selectedNamespaces.map(async (namespace) => {
          const namespacePods = await window.api.getPods(namespace, selectedCluster.name);
          return namespacePods.map((pod: Pod) => ({ ...pod, namespace: pod.namespace || namespace }));
        })
      );
      const loadedPods = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      const failedNamespaces = results.flatMap((result, index) => (
        result.status === "rejected" ? [selectedNamespaces[index]] : []
      ));

      setPods(loadedPods);
      if (failedNamespaces.length > 0 && !isBackground) {
        setError(`No se pudieron consultar los namespaces: ${failedNamespaces.join(", ")}.`);
      }
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
  }, [selectedCluster, selectedNamespaces, setError, setLoading, setPods]);

  const refreshPortForwards = useCallback(async () => {
    try {
      setPortForwards(await window.api.getPortForwards());
    } catch (error) {
      console.error("Error loading port-forwards:", error);
    }
  }, []);

  const fetchPodLogs = useCallback(async (
    pod: Pod,
    isBackground = false,
    lineLimit = logLineLimit
  ) => {
    if (!selectedCluster) return;
    const key = podKey(pod);

    if (!isBackground) {
      setLoading(true);
      setLogErrors((prev) => ({ ...prev, [key]: "" }));
    }

    try {
      const podLogs = await window.api.getPodLogs(
        pod.namespace,
        pod.name,
        selectedCluster.name,
        { lines: parseLogLineLimit(lineLimit) }
      );
      setLogs((prev) => ({ ...prev, [key]: podLogs }));
      setLogErrors((prev) => ({ ...prev, [key]: "" }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error loading logs";
      setLogErrors((prev) => ({ ...prev, [key]: errorMsg }));
      if (!isBackground) {
        setLogs((prev) => ({ ...prev, [key]: "" }));
        setError(errorMsg);
      }
      console.error("Error loading logs:", error);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [logLineLimit, selectedCluster, setError, setLoading]);

  const fetchServiceLogs = useCallback(async (pod: Pod, lineLimit = logLineLimit) => {
    if (!selectedCluster) return;

    setServiceLogsLoading(true);
    setServiceLogsError("");
    setServiceLogsResult(null);

    try {
      const result = await window.api.getServiceLogs(
        pod.namespace,
        pod.name,
        selectedCluster.name,
        { lines: parseLogLineLimit(lineLimit) }
      );
      setServiceLogsResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error loading service logs";
      setServiceLogsError(message);
      console.error("Error loading service logs:", error);
    } finally {
      setServiceLogsLoading(false);
    }
  }, [logLineLimit, selectedCluster]);

  // Scroll inline logs: force-scroll to bottom on first open, tail-follow on auto-refresh.
  useEffect(() => {
    if (!expandedPod || !logs[expandedPod]) return;
    const isFirstOpen = lastScrolledInlinePodRef.current !== expandedPod;
    if (isFirstOpen) {
      lastScrolledInlinePodRef.current = expandedPod;
    }
    requestAnimationFrame(() => scrollToBottomIfNeeded(inlineLogsRef.current, isFirstOpen));
  }, [logs, expandedPod]);

  // Scroll modal logs: force-scroll to bottom on first open, tail-follow on auto-refresh.
  useEffect(() => {
    if (!expandedLogPod || !logs[expandedLogPod]) return;
    const isFirstOpen = lastScrolledModalPodRef.current !== expandedLogPod;
    if (isFirstOpen) {
      lastScrolledModalPodRef.current = expandedLogPod;
    }
    requestAnimationFrame(() => scrollToBottomIfNeeded(expandedLogsRef.current, isFirstOpen));
  }, [logs, expandedLogPod]);

  useEffect(() => {
    if (selectedCluster && selectedNamespaces.length > 0) {
      setSelectedPods(new Set());
      setRecoveries({});
      setServiceLogsOpen(false);
      setServiceLogsResult(null);
      setServiceLogsError("");
      setServiceLogsSearch("");
      setServiceLogsPod(null);
      setOnlyMatchingServiceLogLines(false);
      setPortForwardPod(null);
      setPortForwardError("");
      void loadPods();
    } else {
      setPods([]);
    }
  }, [selectedCluster, selectedNamespaces, loadPods, setPods]);

  useEffect(() => {
    void refreshPortForwards();
    const interval = setInterval(() => {
      void refreshPortForwards();
    }, PORT_FORWARD_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refreshPortForwards]);

  useEffect(() => {
    if (!selectedCluster || selectedNamespaces.length === 0) return;
    const interval = setInterval(() => {
      void loadPods(true);
    }, PODS_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedCluster, selectedNamespaces, loadPods]);

  useEffect(() => {
    // Keep selection only for pods that still exist in the current list.
    setSelectedPods((prev) => {
      if (prev.size === 0) return prev;
      const names = new Set(pods.map(podKey));
      const next = new Set<string>();
      prev.forEach((name) => {
        if (names.has(name)) next.add(name);
      });
      return next;
    });
  }, [pods]);

  useEffect(() => {
    savePodFilters(podFilters);
  }, [podFilters]);

  useEffect(() => {
    saveLogLineLimit(logLineLimit);
  }, [logLineLimit]);

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

  const updateLogSearch = (podName: string, value: string) => {
    setLogSearches((prev) => ({ ...prev, [podName]: value }));
  };

  const updateOnlyMatchingLogLines = (podName: string, value: boolean) => {
    setOnlyMatchingLogLines((prev) => ({ ...prev, [podName]: value }));
  };

  const handleLogLineLimitChange = (value: LogLineLimit) => {
    setLogLineLimit(value);
    const activePodKey = expandedLogPod || expandedPod;
    const activePodForLogs = pods.find((pod) => podKey(pod) === activePodKey);
    if (activePodForLogs) {
      void fetchPodLogs(activePodForLogs, false, value);
    }
    if (serviceLogsOpen && serviceLogsPod) {
      void fetchServiceLogs(serviceLogsPod, value);
    }
  };

  const openServiceLogs = (pod: Pod) => {
    setServiceLogsPod(pod);
    setServiceLogsOpen(true);
    void fetchServiceLogs(pod);
  };

  const handleViewLogs = async (pod: Pod) => {
    if (!selectedCluster) return;
    const key = podKey(pod);

    if (expandedPod === key) {
      setExpandedPod(null);
      return;
    }

    setExpandedPod(key);
    await fetchPodLogs(pod, false);
  };

  useEffect(() => {
    if (!selectedCluster) return;
    const activePodKey = expandedLogPod || expandedPod;
    const activePodForLogs = pods.find((pod) => podKey(pod) === activePodKey);
    if (!activePodForLogs) return;

    const interval = setInterval(() => {
      void fetchPodLogs(activePodForLogs, true);
    }, LOGS_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedCluster, expandedPod, expandedLogPod, fetchPodLogs, pods]);

  const downloadLogs = (pod: Pod) => {
    const content = logs[podKey(pod)];
    if (!content) {
      setError("No hay logs cargados para descargar.");
      return;
    }

    const now = new Date();
    const safeTs = now.toISOString().replace(/[:.]/g, "-");
    const filename = `${pod.namespace}-${pod.name}-${safeTs}.log`;
    downloadTextFile(content, filename);
  };

  const downloadServiceLogs = () => {
    if (!serviceLogsResult) {
      setServiceLogsError("No hay logs del servicio para descargar.");
      return;
    }

    const safeTs = serviceLogsResult.generatedAt.replace(/[:.]/g, "-");
    downloadTextFile(
      serviceLogsResult.content,
      `${serviceLogsResult.serviceName}-todos-los-pods-${safeTs}.log`
    );
  };

  const monitorRecovery = async (
    recoveryId: string,
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
        const namespacedPods = currentPods.map((pod: Pod) => ({
          ...pod,
          namespace: pod.namespace || namespace,
        }));
        const previousPods = useClusterStore.getState().pods;
        setPods([
          ...previousPods.filter((pod) => pod.namespace !== namespace),
          ...namespacedPods,
        ]);

        const deletedStillExists = currentPods.some((p: any) => p.name === deletedPodName);
        const relatedPods = currentPods.filter((p: any) => p.name.startsWith(`${workloadPrefix}-`));
        const runningRelated = relatedPods.filter((p: any) => p.status === "Running").length;
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(95, 20 + Math.floor((elapsed / timeoutMs) * 70));

        if (!deletedStillExists && runningRelated > 0) {
          setRecoveries((prev) => ({
            ...prev,
            [recoveryId]: {
              progress: 100,
              message: `Restablecido (${runningRelated} pod(s) running).`,
            },
          }));

          setTimeout(() => clearRecovery(recoveryId), 3000);

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
          [recoveryId]: { progress, message },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error monitoreando restablecimiento";
        setRecoveries((prev) => ({
          ...prev,
          [recoveryId]: { progress: 100, message },
        }));
        return;
      }
    }

    setRecoveries((prev) => ({
      ...prev,
      [recoveryId]: {
        progress: 100,
        message: "Tiempo de espera agotado. Revisa el estado del deployment.",
      },
    }));

    // Avoid stale banner lingering forever.
    setTimeout(() => clearRecovery(recoveryId), RECOVERY_BANNER_TTL_MS);
  };

  const handleDeletePod = async (pod: Pod) => {
    if (!selectedCluster) return;

    const workloadPrefix = getWorkloadPrefix(pod.name);
    const recoveryId = recoveryKey(pod);
    const clusterName = selectedCluster.name;
    const namespace = pod.namespace;

    const confirmed = window.confirm(
      `Eliminar pod ${pod.name} de ${namespace}? Kubernetes lo recreara automaticamente.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setRecoveries((prev) => ({
      ...prev,
      [recoveryId]: { progress: 10, message: "Eliminando pod..." },
    }));

    try {
      await window.api.deletePod(namespace, pod.name, clusterName);
      setRecoveries((prev) => ({
        ...prev,
        [recoveryId]: { progress: 20, message: "Pod eliminado. Iniciando restablecimiento..." },
      }));

      void monitorRecovery(recoveryId, workloadPrefix, pod.name, namespace, clusterName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error deleting pod";
      setError(message);
      setRecoveries((prev) => ({
        ...prev,
        [recoveryId]: { progress: 100, message },
      }));
    } finally {
      setLoading(false);
    }
  };

  const deletePodsBulk = async (selectedPodKeys: string[]) => {
    if (!selectedCluster || selectedPodKeys.length === 0) return;

    const clusterName = selectedCluster.name;
    const selectedPodItems = pods.filter((pod) => selectedPodKeys.includes(podKey(pod)));

    const confirmed = window.confirm(
      `Eliminar ${selectedPodItems.length} pod(s)? Kubernetes los recreara automaticamente.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const failures: string[] = [];

    for (const pod of selectedPodItems) {
      const workloadPrefix = getWorkloadPrefix(pod.name);
      const recoveryId = recoveryKey(pod);

      setRecoveries((prev) => ({
        ...prev,
        [recoveryId]: { progress: 10, message: "Eliminando pod..." },
      }));

      try {
        await window.api.deletePod(pod.namespace, pod.name, clusterName);
        setRecoveries((prev) => ({
          ...prev,
          [recoveryId]: { progress: 20, message: "Pod eliminado. Iniciando restablecimiento..." },
        }));
        void monitorRecovery(recoveryId, workloadPrefix, pod.name, pod.namespace, clusterName);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error deleting pod";
        failures.push(`${pod.namespace}/${pod.name}: ${message}`);
        setRecoveries((prev) => ({
          ...prev,
          [recoveryId]: { progress: 100, message },
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

  const togglePodSelection = (pod: Pod) => {
    const key = podKey(pod);
    setSelectedPods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const openTerminal = async (pod: Pod) => {
    if (!selectedCluster) return;

    setLoading(true);
    setError(null);
    try {
      const containers = await window.api.getPodContainers(
        pod.namespace,
        pod.name,
        selectedCluster.name
      );

      setTerminalPod(pod);
      setTerminalContainers(containers);
      setTerminalContainer(containers[0] || "");
      setTerminalCommand("");
      setTerminalOutput(`# Terminal del pod ${pod.namespace}/${pod.name}\n`);
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
    if (!selectedCluster || !terminalPod || !terminalContainer) return;
    const command = terminalCommand.trim();
    if (!command) return;

    setTerminalRunning(true);
    setTerminalOutput((prev) => `${prev}\n$ ${command}\n`);
    try {
      const result = await window.api.execPodCommand(
        terminalPod.namespace,
        terminalPod.name,
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

  const openPortForward = (pod: Pod) => {
    const tcpPorts = (pod.ports || []).filter((port) => port.protocol === "TCP");
    if (tcpPorts.length === 0) {
      setError(`El pod ${pod.name} no declara puertos TCP para port-forward.`);
      return;
    }

    const preferredPort = getPreferredPortForwardPort(tcpPorts);
    if (!preferredPort) return;
    setPortForwardPod(pod);
    setPortForwardPortKey(podPortKey(preferredPort));
    setPortForwardLocalPort(String(DEFAULT_PORT_FORWARD_LOCAL_PORT));
    setPortForwardError("");
    void refreshPortForwards();
  };

  const closePortForward = () => {
    if (portForwardLoading) return;
    setPortForwardPod(null);
    setPortForwardPortKey("");
    setPortForwardLocalPort("");
    setPortForwardError("");
  };

  const startPortForward = async () => {
    if (!selectedCluster || !portForwardPod) return;

    const selectedPort = (portForwardPod.ports || []).find(
      (port) => podPortKey(port) === portForwardPortKey && port.protocol === "TCP"
    );
    if (!selectedPort) {
      setPortForwardError("Selecciona un puerto TCP valido.");
      return;
    }

    const localPort = Number(portForwardLocalPort);
    if (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535) {
      setPortForwardError("El puerto local debe ser un numero entero entre 1 y 65535.");
      return;
    }

    setPortForwardLoading(true);
    setPortForwardError("");
    try {
      const session = await window.api.startPortForward({
        cluster: selectedCluster.name,
        namespace: portForwardPod.namespace,
        podName: portForwardPod.name,
        remotePort: selectedPort.port,
        localPort,
      });
      setPortForwards((previous) => [
        ...previous.filter((item) => item.id !== session.id),
        session,
      ]);
    } catch (error) {
      setPortForwardError(
        error instanceof Error ? error.message : "No se pudo iniciar el port-forward."
      );
    } finally {
      setPortForwardLoading(false);
    }
  };

  const stopPortForward = async (session: PortForwardSession) => {
    setPortForwardLoading(true);
    setPortForwardError("");
    try {
      await window.api.stopPortForward(session.id);
      setPortForwards((previous) => previous.filter((item) => item.id !== session.id));
    } catch (error) {
      setPortForwardError(
        error instanceof Error ? error.message : "No se pudo detener el port-forward."
      );
    } finally {
      setPortForwardLoading(false);
    }
  };

  const openPortForwardUrl = async (session: PortForwardSession) => {
    try {
      await window.api.openExternalUrl(session.url);
    } catch (error) {
      setPortForwardError(
        error instanceof Error ? error.message : "No se pudo abrir la URL local."
      );
    }
  };

  const copyServiceName = async (pod: Pod) => {
    const serviceName = buildServiceFqdn(pod.name, pod.namespace);
    try {
      await navigator.clipboard.writeText(serviceName);
      setCopiedServiceForPod(podKey(pod));
      setCopiedServiceValue(serviceName);
      setTimeout(() => setCopiedServiceForPod((prev) => (prev === podKey(pod) ? null : prev)), 1400);
      setTimeout(() => setCopiedServiceValue((prev) => (prev === serviceName ? null : prev)), 1800);
    } catch {
      setError("No se pudo copiar al portapapeles");
    }
  };

  if (!selectedCluster || selectedNamespaces.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Selecciona un cluster y agrega al menos un namespace para ver pods.
      </div>
    );
  }

  const effectivePodFilters = search.trim()
    ? addUniqueValue(podFilters, search)
    : podFilters;
  const filteredPods = pods.filter((pod) => (
    matchesAnyFilter(deriveServiceNameFromPod(pod.name), effectivePodFilters)
  ));
  const serviceSuggestions = Array.from(
    new Set(pods.map((pod) => deriveServiceNameFromPod(pod.name)))
  ).filter(
    (serviceName) => !podFilters.includes(serviceName)
  );

  const forwardablePorts = (portForwardPod?.ports || []).filter(
    (port) => port.protocol === "TCP"
  );
  const activePortForwardsForPod = portForwardPod
    ? portForwards.filter((session) => (
      session.cluster === selectedCluster.name
      && session.namespace === portForwardPod.namespace
      && session.podName === portForwardPod.name
    ))
    : [];

  const podHasTcpPort = (pod: Pod): boolean => (
    (pod.ports || []).some((port) => port.protocol === "TCP")
  );

  const activePortForwardCount = (pod: Pod): number => (
    portForwards.filter((session) => (
      session.cluster === selectedCluster.name
      && session.namespace === pod.namespace
      && session.podName === pod.name
    )).length
  );

  const allFilteredSelected =
    filteredPods.length > 0 && filteredPods.every((pod) => selectedPods.has(podKey(pod)));
  const expandedLogPodItem = pods.find((pod) => podKey(pod) === expandedLogPod);

  const toggleSelectAllFiltered = () => {
    setSelectedPods((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredPods.forEach((pod) => next.delete(podKey(pod)));
      } else {
        filteredPods.forEach((pod) => next.add(podKey(pod)));
      }
      return next;
    });
  };

  const addPodFilter = () => {
    const nextFilters = addUniqueValue(podFilters, search);
    if (nextFilters === podFilters) return;
    setPodFilters(nextFilters);
    setSearch("");
  };

  const activeRecoveries = Object.entries(recoveries);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header con buscador */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold whitespace-nowrap">
            Pods en <span className="text-blue-600">{selectedNamespaces.length} namespace(s)</span>
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({filteredPods.length}{effectivePodFilters.length > 0 ? ` de ${pods.length}` : ""})
            </span>
          </h2>
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                list="pod-filter-suggestions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPodFilter();
                  }
                }}
                placeholder="Busca y agrega servicios..."
                className="w-full pl-8 pr-9 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="pod-filter-suggestions">
                {serviceSuggestions.map((serviceName) => (
                  <option key={serviceName} value={serviceName} />
                ))}
              </datalist>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  title="Limpiar texto"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={addPodFilter}
              disabled={!search.trim()}
              className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition disabled:opacity-40"
              title="Agregar filtro de pod o servicio"
            >
              <AddIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <label htmlFor="pod-log-line-limit" className="whitespace-nowrap">Logs</label>
            <select
              id="pod-log-line-limit"
              value={logLineLimit}
              onChange={(event) => handleLogLineLimitChange(event.target.value as LogLineLimit)}
              className="px-2 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Cantidad de logs a cargar"
            >
              {LOG_LINE_LIMIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void loadPods()}
            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition"
            title="Actualizar pods"
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
        {podFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Visualizando coincidencias de:</span>
            {podFilters.map((filter) => (
              <span key={filter} className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                {filter}
                <button
                  type="button"
                  onClick={() => setPodFilters((previous) => previous.filter((item) => item !== filter))}
                  className="rounded-full p-0.5 hover:bg-blue-100"
                  title={`Quitar filtro ${filter}`}
                  aria-label={`Quitar filtro de servicio ${filter}`}
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setPodFilters([])}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
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
              <div className="w-16">Restarts</div>
              <div className="w-12">Age</div>
              <div className="w-44">Actions</div>
            </div>

            {filteredPods.map((pod) => (
              <div key={podKey(pod)} className="bg-white hover:bg-gray-50 transition border-b border-gray-200">
                <div className="px-4 py-4 flex items-center gap-4">
                  <div className="w-8 flex justify-center">
                    <input
                      type="checkbox"
                      checked={selectedPods.has(podKey(pod))}
                      onChange={() => togglePodSelection(pod)}
                      title={`Seleccionar ${pod.namespace}/${pod.name}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate text-sm" title={pod.name}>{pod.name}</h3>
                    <p className="text-xs text-gray-500 truncate">
                      <span className="font-medium text-blue-700">{pod.namespace}</span> · Image: {pod.image}
                    </p>
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
                  <div className="w-16 text-sm font-medium text-gray-900">{pod.restarts}</div>
                  <div className="w-12 text-sm text-gray-600">{pod.age || "-"}</div>
                  <div className="w-44 flex items-center gap-2">
                    <button
                      onClick={() => void copyServiceName(pod)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title={`Copiar servicio: ${buildServiceFqdn(pod.name, pod.namespace)}`}
                    >
                      {copiedServiceForPod === podKey(pod)
                        ? <CheckIcon className="w-4 h-4 text-green-600" />
                        : <CopyIcon className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleViewLogs(pod)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="View logs"
                    >
                      <FileTextIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openServiceLogs(pod)}
                      className="p-1 hover:bg-blue-100 text-blue-700 rounded transition"
                      title="Ver logs de todas las replicas del servicio"
                    >
                      <ServiceLogsIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openPortForward(pod)}
                      disabled={!podHasTcpPort(pod)}
                      className={`p-1 rounded transition disabled:cursor-not-allowed ${
                        activePortForwardCount(pod) > 0
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "hover:bg-blue-100 text-blue-700 disabled:text-gray-300 disabled:hover:bg-transparent"
                      }`}
                      title={podHasTcpPort(pod)
                        ? activePortForwardCount(pod) > 0
                          ? `Gestionar port-forward (${activePortForwardCount(pod)} activo(s))`
                          : "Crear port-forward"
                        : "El pod no declara puertos TCP"}
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openTerminal(pod)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="Abrir terminal del pod"
                    >
                      <TerminalIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadLogs(pod)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      title="Download logs"
                      disabled={!logs[podKey(pod)]}
                    >
                      <DownloadIcon className={`w-4 h-4 ${logs[podKey(pod)] ? "" : "text-gray-300"}`} />
                    </button>
                    <button
                      onClick={() => handleDeletePod(pod)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded transition"
                      title="Delete pod"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedPod === podKey(pod) && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4 max-h-64 overflow-hidden flex flex-col">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Logs:</h4>
                    {logs[podKey(pod)] && (
                      <LogSearchControls
                        search={logSearches[podKey(pod)] || ""}
                        onlyMatching={Boolean(onlyMatchingLogLines[podKey(pod)])}
                        matchCount={countLogMatches(logs[podKey(pod)], logSearches[podKey(pod)] || "")}
                        onSearchChange={(value) => updateLogSearch(podKey(pod), value)}
                        onOnlyMatchingChange={(value) => updateOnlyMatchingLogLines(podKey(pod), value)}
                      />
                    )}
                    {logErrors[podKey(pod)] ? (
                      <pre className="flex-1 text-xs bg-red-50 p-3 rounded border border-red-200 text-red-700 font-mono overflow-auto">
                        {logErrors[podKey(pod)]}
                      </pre>
                    ) : logs[podKey(pod)] ? (
                      <pre
                        ref={expandedPod === podKey(pod) ? inlineLogsRef : null}
                        className="flex-1 text-xs bg-white p-3 rounded border border-gray-200 overflow-auto text-gray-700 font-mono"
                      >
                        <HighlightedLog
                          content={getVisibleLog(
                            logs[podKey(pod)],
                            logSearches[podKey(pod)] || "",
                            Boolean(onlyMatchingLogLines[podKey(pod)])
                          )}
                          search={logSearches[podKey(pod)] || ""}
                        />
                      </pre>
                    ) : (
                      <pre className="flex-1 text-xs bg-blue-50 p-3 rounded border border-blue-200 text-blue-700 font-mono">
                        Cargando logs...
                      </pre>
                    )}
                    {logs[podKey(pod)] && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setExpandedLogPod(podKey(pod));
                            requestAnimationFrame(() => scrollToBottomIfNeeded(expandedLogsRef.current, true));
                          }}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                        >
                          Expandir logs
                        </button>
                        <button
                          onClick={() => downloadLogs(pod)}
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

      {/* Modal de logs de todas las replicas del servicio */}
      {serviceLogsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-7xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Logs del servicio: {serviceLogsResult?.serviceName || serviceLogsPod?.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Namespace: {serviceLogsPod?.namespace} · pod de referencia: {serviceLogsPod?.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => serviceLogsPod && void fetchServiceLogs(serviceLogsPod)}
                  disabled={serviceLogsLoading || !serviceLogsPod}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                >
                  <RefreshIcon className={`w-4 h-4 ${serviceLogsLoading ? "animate-spin" : ""}`} />
                  Actualizar
                </button>
                <button
                  onClick={() => setServiceLogsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded transition"
                  title="Cerrar"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {serviceLogsResult && (
              <div className="px-4 pt-3 bg-gray-50 border-b border-gray-200">
                <LogSearchControls
                  search={serviceLogsSearch}
                  onlyMatching={onlyMatchingServiceLogLines}
                  matchCount={countLogMatches(serviceLogsResult.content, serviceLogsSearch)}
                  onSearchChange={setServiceLogsSearch}
                  onOnlyMatchingChange={setOnlyMatchingServiceLogLines}
                />
                <p className={`pb-3 text-xs ${serviceLogsResult.errorCount > 0 ? "text-amber-700" : "text-gray-500"}`}>
                  {serviceLogsResult.podCount} replicas · {serviceLogsResult.successfulContainerCount} de {serviceLogsResult.containerCount} contenedores consultados
                  {serviceLogsResult.errorCount > 0 ? ` · ${serviceLogsResult.errorCount} con error` : ""}
                  {` · ${new Date(serviceLogsResult.generatedAt).toLocaleString()}`}
                </p>
              </div>
            )}

            <div className="flex-1 min-h-0 bg-gray-900">
              {serviceLogsLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-green-300">
                  <RefreshIcon className="w-5 h-5 mr-2 animate-spin" />
                  Consultando logs de las replicas del servicio...
                </div>
              ) : serviceLogsError ? (
                <pre className="h-full overflow-auto text-xs bg-red-950 text-red-200 p-4 font-mono whitespace-pre-wrap break-words">
                  {serviceLogsError}
                </pre>
              ) : serviceLogsResult ? (
                <pre className="h-full overflow-auto text-xs text-green-400 p-4 font-mono whitespace-pre-wrap break-words">
                  <HighlightedLog
                    content={getVisibleLog(
                      serviceLogsResult.content,
                      serviceLogsSearch,
                      onlyMatchingServiceLogLines
                    )}
                    search={serviceLogsSearch}
                  />
                </pre>
              ) : null}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Se usa kubectl con un maximo de cuatro consultas simultaneas; no requiere Stern.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadServiceLogs}
                  disabled={!serviceLogsResult || serviceLogsLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Descargar logs del servicio
                </button>
                <button
                  onClick={() => setServiceLogsOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de logs expandidos */}
      {expandedLogPod && expandedLogPodItem && logs[expandedLogPod] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Logs: {expandedLogPod}</h3>
              <button
                onClick={() => setExpandedLogPod(null)}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 pt-4 bg-gray-50 border-b border-gray-200">
              <LogSearchControls
                search={logSearches[expandedLogPod] || ""}
                onlyMatching={Boolean(onlyMatchingLogLines[expandedLogPod])}
                matchCount={countLogMatches(logs[expandedLogPod], logSearches[expandedLogPod] || "")}
                onSearchChange={(value) => updateLogSearch(expandedLogPod, value)}
                onOnlyMatchingChange={(value) => updateOnlyMatchingLogLines(expandedLogPod, value)}
              />
            </div>
            <pre
              ref={expandedLogsRef}
              className="flex-1 overflow-auto text-xs bg-gray-900 text-green-400 p-4 font-mono whitespace-pre-wrap break-words"
            >
              <HighlightedLog
                content={getVisibleLog(
                  logs[expandedLogPod],
                  logSearches[expandedLogPod] || "",
                  Boolean(onlyMatchingLogLines[expandedLogPod])
                )}
                search={logSearches[expandedLogPod] || ""}
              />
            </pre>
            <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => downloadLogs(expandedLogPodItem)}
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

      {/* Modal port-forward */}
      {portForwardPod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Port-forward: {portForwardPod.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedCluster.name} / {portForwardPod.namespace}
                </p>
              </div>
              <button
                onClick={closePortForward}
                disabled={portForwardLoading}
                className="p-1 hover:bg-gray-100 rounded transition disabled:opacity-50"
                title="Cerrar"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_auto] gap-3 items-end">
                <label className="text-xs font-medium text-gray-700">
                  Puerto del pod
                  <select
                    value={portForwardPortKey}
                    onChange={(event) => {
                      const nextKey = event.target.value;
                      setPortForwardPortKey(nextKey);
                      setPortForwardLocalPort(String(DEFAULT_PORT_FORWARD_LOCAL_PORT));
                    }}
                    disabled={portForwardLoading}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {forwardablePorts.map((port) => (
                      <option key={podPortKey(port)} value={podPortKey(port)}>
                        {podPortLabel(port)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-medium text-gray-700">
                  Puerto local
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={portForwardLocalPort}
                    onChange={(event) => setPortForwardLocalPort(event.target.value)}
                    disabled={portForwardLoading}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </label>

                <button
                  onClick={() => void startPortForward()}
                  disabled={portForwardLoading || forwardablePorts.length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {portForwardLoading ? "Procesando..." : "Iniciar"}
                </button>
              </div>

              <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                El puerto se publica solo en 127.0.0.1 y permanece activo mientras KubeVista
                este abierto o hasta que lo detengas.
              </p>

              {portForwardError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 whitespace-pre-wrap">
                  {portForwardError}
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Port-forwards activos
                </h4>
                {activePortForwardsForPod.length === 0 ? (
                  <p className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-md p-3">
                    No hay port-forwards activos para este pod.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activePortForwardsForPod.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-green-200 bg-green-50 rounded-md p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-green-900">
                            127.0.0.1:{session.localPort} → pod:{session.remotePort}/TCP
                          </p>
                          <p className="text-xs text-green-800 break-all">{session.url}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void openPortForwardUrl(session)}
                            disabled={portForwardLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-green-300 text-green-800 rounded hover:bg-green-100 disabled:opacity-50"
                          >
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                            Abrir URL
                          </button>
                          <button
                            onClick={() => void stopPortForward(session)}
                            disabled={portForwardLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            <StopIcon className="w-3.5 h-3.5" />
                            Detener
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-end">
              <button
                onClick={closePortForward}
                disabled={portForwardLoading}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
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
                <h3 className="text-lg font-semibold text-gray-900">Terminal: {terminalPod.name}</h3>
                <p className="text-xs text-gray-500">Namespace: {terminalPod.namespace}</p>
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
