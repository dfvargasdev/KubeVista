export interface NamespaceContainerLog {
  podName: string;
  containerName?: string;
  content: string;
  error?: string;
}

export interface NamespaceLogFormatOptions {
  clusterName: string;
  namespace: string;
  generatedAt: string;
  podCount: number;
  containerLogs: NamespaceContainerLog[];
}

interface FormattedLogLine {
  sortKey: string;
  text: string;
}

const KUBERNETES_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function getSourceLabel(log: NamespaceContainerLog): string {
  return `${log.podName}/${log.containerName || "default"}`;
}

function formatLogLines(log: NamespaceContainerLog): FormattedLogLine[] {
  const source = getSourceLabel(log);

  return log.content
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const separatorIndex = line.indexOf(" ");
      const possibleTimestamp = separatorIndex > 0 ? line.slice(0, separatorIndex) : "";
      const hasTimestamp = KUBERNETES_TIMESTAMP_PATTERN.test(possibleTimestamp);
      const message = hasTimestamp ? line.slice(separatorIndex + 1) : line;
      const timestamp = hasTimestamp ? possibleTimestamp : "";

      return {
        sortKey: timestamp
          ? `0:${timestamp}:${source}:${index.toString().padStart(8, "0")}`
          : `1:${source}:${index.toString().padStart(8, "0")}`,
        text: `${timestamp ? `${timestamp} ` : ""}[${source}] ${message}`,
      };
    });
}

export function formatNamespaceLogsContent(options: NamespaceLogFormatOptions): string {
  const successfulLogs = options.containerLogs.filter((log) => !log.error);
  const failedLogs = options.containerLogs.filter((log) => Boolean(log.error));
  const logLines = successfulLogs
    .flatMap(formatLogLines)
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .map((line) => line.text);

  const header = [
    "# KubeVista - logs agregados",
    `# Cluster: ${options.clusterName}`,
    `# Namespace: ${options.namespace}`,
    `# Generado: ${options.generatedAt}`,
    `# Pods: ${options.podCount} | Contenedores: ${options.containerLogs.length} | Errores: ${failedLogs.length}`,
  ];

  const body = logLines.length > 0
    ? logLines
    : [options.containerLogs.length > 0
      ? "# No hay lineas de log disponibles para los contenedores consultados."
      : "# No hay pods en este namespace."];

  const errorSection = failedLogs.length > 0
    ? [
      "",
      "# Errores al obtener logs",
      ...failedLogs.map((log) => (
        `# [${getSourceLabel(log)}] ${String(log.error).replace(/\r?\n/g, " ")}`
      )),
    ]
    : [];

  return [...header, "", ...body, ...errorSection].join("\n");
}
