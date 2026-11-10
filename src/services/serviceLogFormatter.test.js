const { formatServiceLogsContent } = require("./serviceLogFormatter");

describe("formatServiceLogsContent", () => {
  test("combines service pods in timestamp order and prefixes every line with its source", () => {
    const content = formatServiceLogsContent({
      clusterName: "dev-cluster",
      namespace: "payments",
      serviceName: "payments-api",
      generatedAt: "2026-11-10T20:00:00.000Z",
      podCount: 2,
      containerLogs: [
        {
          podName: "payments-b",
          containerName: "api",
          content: "2026-11-10T19:00:02.000Z second",
        },
        {
          podName: "payments-a",
          containerName: "worker",
          content: "2026-11-10T19:00:01.000Z first\n2026-11-10T19:00:03.000Z third",
        },
      ],
    });

    expect(content).toContain("# Servicio: payments-api");
    expect(content).toContain("# Pods: 2 | Contenedores: 2 | Errores: 0");
    expect(content).toContain("[payments-a/worker] first");
    expect(content).toContain("[payments-b/api] second");
    expect(content.indexOf("first")).toBeLessThan(content.indexOf("second"));
    expect(content.indexOf("second")).toBeLessThan(content.indexOf("third"));
  });

  test("keeps successful logs and reports container failures", () => {
    const content = formatServiceLogsContent({
      clusterName: "dev-cluster",
      namespace: "payments",
      serviceName: "payments-api",
      generatedAt: "2026-11-10T20:00:00.000Z",
      podCount: 2,
      containerLogs: [
        {
          podName: "payments-a",
          containerName: "api",
          content: "plain log line",
        },
        {
          podName: "payments-b",
          containerName: "api",
          content: "",
          error: "pod is not available\ntry again",
        },
      ],
    });

    expect(content).toContain("[payments-a/api] plain log line");
    expect(content).toContain("# Errores al obtener logs");
    expect(content).toContain("# [payments-b/api] pod is not available try again");
  });
});
