import React from "react";
import { ClusterSelector } from "./ClusterSelector";
import { NamespaceSelector } from "./NamespaceSelector";
import { PodList } from "./PodList";
import { useClusterStore } from "../store/clusterStore";
import { FiAlertCircle } from "react-icons/fi";

const AlertIcon = FiAlertCircle as React.ElementType;

export const Dashboard: React.FC = () => {
  const { loading, error } = useClusterStore();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">LA</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Lens Alternativa</h1>
          </div>
          {loading && (
            <span className="text-sm text-gray-500">Loading...</span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Controls Bar */}
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cluster
              </label>
              <ClusterSelector />
            </div>
            <div className="flex-1">
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
        <div className="flex-1 overflow-hidden min-h-0">
          <PodList />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3 text-xs text-gray-500">
        <p>Lens Alternativa • Kubernetes Cluster Manager</p>
      </footer>
    </div>
  );
};
