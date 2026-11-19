const {
  buildPortForwardArgs,
  normalizePortForwardRequest,
} = require("./portForwardManager");

describe("portForwardManager helpers", () => {
  const request = {
    cluster: "aks-development",
    namespace: "tools",
    podName: "pgadmin-7b6c959558-2kftt",
    remotePort: 80,
    localPort: 8080,
  };

  test("builds a pod port-forward bound only to loopback", () => {
    expect(buildPortForwardArgs(request)).toEqual([
      "--context",
      "aks-development",
      "--namespace",
      "tools",
      "port-forward",
      "pod/pgadmin-7b6c959558-2kftt",
      "8080:80",
      "--address",
      "127.0.0.1",
    ]);
  });

  test.each([0, 65536, 80.5])("rejects invalid local port %s", (localPort) => {
    expect(() => normalizePortForwardRequest({ ...request, localPort })).toThrow(
      "El puerto local debe ser un numero entero entre 1 y 65535."
    );
  });

  test("rejects an empty pod name", () => {
    expect(() => normalizePortForwardRequest({ ...request, podName: "  " })).toThrow(
      "El pod es obligatorio."
    );
  });
});
