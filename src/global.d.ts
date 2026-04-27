interface Window {
  api: {
    getClusters: () => Promise<any>;
    getPods: (namespace: string, cluster: string) => Promise<any>;
    getNamespaces: (cluster: string) => Promise<any>;
    getPodLogs: (namespace: string, podName: string, cluster: string) => Promise<string>;
    deletePod: (namespace: string, podName: string, cluster: string) => Promise<void>;
  };
}
