export interface PodPort {
  containerName: string;
  name?: string;
  port: number;
  protocol: string;
}

export function getPodPorts(pod: any): PodPort[] {
  const containers = Array.isArray(pod?.spec?.containers) ? pod.spec.containers : [];

  return containers.flatMap((container: any) => {
    const ports = Array.isArray(container?.ports) ? container.ports : [];

    return ports
      .filter((port: any) => Number.isInteger(port?.containerPort))
      .map((port: any) => ({
        containerName: container?.name || "contenedor",
        name: typeof port.name === "string" && port.name ? port.name : undefined,
        port: port.containerPort,
        protocol: typeof port.protocol === "string" && port.protocol
          ? port.protocol.toUpperCase()
          : "TCP",
      }));
  });
}

export function getPreferredPortForwardPort(ports: PodPort[]): PodPort | undefined {
  const tcpPorts = ports.filter((port) => port.protocol === "TCP");
  return tcpPorts.find((port) => port.containerName !== "istio-proxy") || tcpPorts[0];
}
