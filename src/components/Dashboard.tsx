import React, { useState } from "react";
import { ClusterSelector } from "./ClusterSelector";
import { NamespaceSelector } from "./NamespaceSelector";
import { PodList } from "./PodList";
import { ConfigMapList } from "./ConfigMapList";
import { useClusterStore } from "../store/clusterStore";
import { FiAlertCircle } from "react-icons/fi";

const AlertIcon = FiAlertCircle as React.ElementType;

export const Dashboard: React.FC = () => {
  const { error } = useClusterStore();
  const [activeTab, setActiveTab] = useState<"pods" | "configmaps">("pods");

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Controls Bar */}
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
            <div className="lg:w-80 lg:flex-none">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cluster
              </label>
              <ClusterSelector />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Namespace
              </label>
              <NamespaceSelector />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-gap-3 text-red-800">
            <AlertIcon className="flex-shrink-0 w-5 h-5 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Pod List */}
        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-4">
          <div className="flex gap-0 max-w-7xl">
            {(["pods", "configmaps"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "pods" ? "Pods" : "Config Maps"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === "pods" ? <PodList /> : <ConfigMapList />}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3 text-xs text-gray-500">
        <p>KubeVista • Kubernetes Cluster Manager • Diego Vargas (dfVargasDev)</p>
      </footer>
    </div>
  );
};
