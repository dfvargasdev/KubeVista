const {
  getTelepresenceContext,
  isTelepresenceConnected,
} = require("./telepresenceStatus");

describe("isTelepresenceConnected", () => {
  test("recognizes a connected user daemon", () => {
    expect(isTelepresenceConnected({
      success: true,
      stdout: "User Daemon: Running\n  Status: Connected to context aks-dev",
      stderr: "",
    })).toBe(true);
  });

  test("does not treat a running but disconnected daemon as connected", () => {
    expect(isTelepresenceConnected({
      success: true,
      stdout: "Root Daemon: Running\nUser Daemon: Not connected",
      stderr: "",
    })).toBe(false);
  });

  test("treats command failures as disconnected", () => {
    expect(isTelepresenceConnected({
      success: false,
      stdout: "",
      stderr: "telepresence is not installed",
    })).toBe(false);
  });

  test("extracts the context from a connected status", () => {
    expect(getTelepresenceContext({
      success: true,
      stdout: "User Daemon: Running\n  Status: Connected to context aks-dev, namespace default",
      stderr: "",
    })).toBe("aks-dev");
  });

  test("extracts the context from the detailed status field", () => {
    expect(getTelepresenceContext({
      success: true,
      stdout: "User Daemon: Running\n  Status: Connected\n  Kubernetes context: aks-test-tribu-canales",
      stderr: "",
    })).toBe("aks-test-tribu-canales");
  });
});
