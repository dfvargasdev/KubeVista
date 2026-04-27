import { create } from "zustand";
import type { Cluster, Pod, Namespace } from "../services/kubernetesService";

interface ClusterStore {
  clusters: Cluster[];
  selectedCluster: Cluster | null;
  namespaces: Namespace[];
  selectedNamespace: string | null;
  pods: Pod[];
  loading: boolean;
  error: string | null;

  setClusters: (clusters: Cluster[]) => void;
  setSelectedCluster: (cluster: Cluster | null) => void;
  setNamespaces: (namespaces: Namespace[]) => void;
  setSelectedNamespace: (namespace: string | null) => void;
  setPods: (pods: Pod[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useClusterStore = create<ClusterStore>((set) => ({
  clusters: [],
  selectedCluster: null,
  namespaces: [],
  selectedNamespace: null,
  pods: [],
  loading: false,
  error: null,

  setClusters: (clusters) => set({ clusters }),
  setSelectedCluster: (selectedCluster) => set({ selectedCluster }),
  setNamespaces: (namespaces) => set({ namespaces }),
  setSelectedNamespace: (selectedNamespace) => set({ selectedNamespace }),
  setPods: (pods) => set({ pods }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
