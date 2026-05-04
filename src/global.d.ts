interface Window {
  api: {
    getClusters: () => Promise<any>;
    getPods: (namespace: string, cluster: string) => Promise<any>;
    getNamespaces: (cluster: string) => Promise<any>;
    getPodLogs: (namespace: string, podName: string, cluster: string) => Promise<string>;
    deletePod: (namespace: string, podName: string, cluster: string) => Promise<void>;
    getPodContainers: (namespace: string, podName: string, cluster: string) => Promise<string[]>;
    getConfigMaps: (namespace: string, cluster: string) => Promise<any[]>;
    updateConfigMap: (namespace: string, name: string, data: Record<string, string>, cluster: string) => Promise<void>;
    execPodCommand: (
      namespace: string,
      podName: string,
      containerName: string,
      cluster: string,
      command: string
    ) => Promise<{ success: boolean; stdout: string; stderr: string }>;
    openExternalUrl: (url: string) => Promise<void>;
    installTool: (tool: "azure-cli" | "kubectl" | "kubelogin" | "all") => Promise<{ message: string }>;
    azureLogin: () => Promise<{ message: string }>;
    telepresenceConnect: (clusterContext: string) => Promise<{ success: boolean; stdout: string; stderr: string }>;
    telepresenceStatus: () => Promise<{ success: boolean; stdout: string; stderr: string }>;
    telepresenceQuit: () => Promise<{ success: boolean; stdout: string; stderr: string }>;
  };
}
