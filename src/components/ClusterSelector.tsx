import React, { useState, useEffect } from "react";
import { useClusterStore } from "../store/clusterStore";
import { FiChevronDown, FiRefreshCw, FiServer } from "react-icons/fi";

const ServerIcon = FiServer as React.ElementType;
const ChevronDownIcon = FiChevronDown as React.ElementType;
const RefreshIcon = FiRefreshCw as React.ElementType;

export const ClusterSelector: React.FC = () => {
  const { clusters, selectedCluster, setSelectedCluster, setLoading, setClusters } = useClusterStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadClusters = async () => {
      setLoading(true);
      try {
        const result = await window.api.getClusters();
        setClusters(result);
        if (result.length > 0 && !selectedCluster) {
          setSelectedCluster(result[0]);
        }
      } catch (error) {
        console.error("Error loading clusters:", error);
      } finally {
        setLoading(false);
      }
    };

    loadClusters();
  }, []);

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
                setSelectedCluster(cluster);
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
