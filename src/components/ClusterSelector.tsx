import React, { useState, useEffect } from "react";
import { useClusterStore } from "../store/clusterStore";
import { FiChevronDown, FiRefreshCw, FiServer } from "react-icons/fi";

const ServerIcon = FiServer as React.ElementType;
const ChevronDownIcon = FiChevronDown as React.ElementType;
const RefreshIcon = FiRefreshCw as React.ElementType;
const LAST_CLUSTER_KEY = "last-selected-cluster";
const LAST_NS_BY_CLUSTER_KEY = "last-selected-namespace-by-cluster";
const LAST_NS_KEY = "last-selected-namespace";

function loadLastClusterName(): string | null {
  try {
    return localStorage.getItem(LAST_CLUSTER_KEY);
  } catch {
    return null;
  }
}

function saveLastClusterName(name: string): void {
  try {
    localStorage.setItem(LAST_CLUSTER_KEY, name);
  } catch {}
}

function loadLastNamespaceForCluster(clusterName: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(LAST_NS_BY_CLUSTER_KEY) || "{}") as Record<string, string>;
    if (map[clusterName]) return map[clusterName];
    return localStorage.getItem(LAST_NS_KEY);
  } catch {
    return null;
  }
}

export const ClusterSelector: React.FC = () => {
  const { clusters, selectedCluster, setSelectedCluster, setSelectedNamespace, setLoading, setClusters } = useClusterStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (selectedCluster?.name) {
      saveLastClusterName(selectedCluster.name);
    }
  }, [selectedCluster]);

  useEffect(() => {
    const loadClusters = async () => {
      setLoading(true);
      try {
        const result = await window.api.getClusters();
        setClusters(result);

        if (result.length > 0 && !selectedCluster) {
          const lastCluster = loadLastClusterName();
          const preferred = lastCluster
            ? result.find((c: { name: string }) => c.name === lastCluster)
            : null;
          const chosenCluster = preferred || result[0];
          const lastNs = loadLastNamespaceForCluster(chosenCluster.name);
          // Set both in the same synchronous block so React batches them into one render.
          // This guarantees PodList sees selectedCluster && selectedNamespace together.
          setSelectedCluster(chosenCluster);
          if (lastNs) setSelectedNamespace(lastNs);
        }
      } catch (error) {
        console.error("Error loading clusters:", error);
      } finally {
        setLoading(false);
      }
    };

    loadClusters();
  }, [selectedCluster, setClusters, setLoading, setSelectedCluster]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await window.api.getClusters();
      setClusters(result);
    } catch (error) {
      console.error("Error refreshing clusters:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block w-full max-w-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ServerIcon className="text-blue-600" />
          <span className="font-medium">{selectedCluster?.name || "Select Cluster"}</span>
        </div>
        <ChevronDownIcon className={`transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          {clusters.map((cluster) => (
            <button
              key={cluster.name}
              onClick={() => {
                const lastNs = loadLastNamespaceForCluster(cluster.name);
                setSelectedCluster(cluster);
                if (lastNs) setSelectedNamespace(lastNs);
                saveLastClusterName(cluster.name);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                selectedCluster?.name === cluster.name ? "bg-blue-50 text-blue-600" : ""
              }`}
            >
              {cluster.name}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleRefresh}
        className="ml-2 p-2 hover:bg-gray-100 rounded-lg transition"
        title="Refresh clusters"
      >
        <RefreshIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
