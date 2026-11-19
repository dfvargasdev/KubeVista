const { getPodPorts, getPreferredPortForwardPort } = require("./podPorts");

describe("getPodPorts", () => {
  test("maps named and unnamed ports from every pod container", () => {
    const ports = getPodPorts({
      spec: {
        containers: [
          {
            name: "pgadmin",
            ports: [{ containerPort: 80, protocol: "TCP" }],
          },
          {
            name: "metrics",
            ports: [{ name: "metrics", containerPort: 9090 }],
          },
        ],
      },
    });

    expect(ports).toEqual([
      { containerName: "pgadmin", name: undefined, port: 80, protocol: "TCP" },
      { containerName: "metrics", name: "metrics", port: 9090, protocol: "TCP" },
    ]);
  });

  test("preserves non-TCP protocols so the UI can exclude them", () => {
    expect(getPodPorts({
      spec: {
        containers: [{ name: "dns", ports: [{ containerPort: 53, protocol: "UDP" }] }],
      },
    })).toEqual([
      { containerName: "dns", name: undefined, port: 53, protocol: "UDP" },
    ]);
  });

  test("prefers the application TCP port over istio-proxy", () => {
    const ports = [
      { containerName: "istio-proxy", name: "http-envoy-prom", port: 15090, protocol: "TCP" },
      { containerName: "pgadmin", name: "pgadmin", port: 80, protocol: "TCP" },
    ];

    expect(getPreferredPortForwardPort(ports)).toEqual(ports[1]);
  });

  test("uses the istio port when it is the only TCP option", () => {
    const istioPort = {
      containerName: "istio-proxy",
      name: "http-envoy-prom",
      port: 15090,
      protocol: "TCP",
    };

    expect(getPreferredPortForwardPort([istioPort])).toEqual(istioPort);
  });
});
