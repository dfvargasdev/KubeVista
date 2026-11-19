const {
  addUniqueValue,
  deriveServiceNameFromPod,
  matchesAnyFilter,
} = require("./selectionFilters");

describe("selection filters", () => {
  test("adds trimmed values once", () => {
    expect(addUniqueValue(["payments"], "  orders  ")).toEqual(["payments", "orders"]);
    expect(addUniqueValue(["payments"], "payments")).toEqual(["payments"]);
    expect(addUniqueValue(["payments"], "   ")).toEqual(["payments"]);
  });

  test("matches any selected service filter without case sensitivity", () => {
    const filters = ["payments", "ORDERS"];

    expect(matchesAnyFilter("deployment-payments-api-123", filters)).toBe(true);
    expect(matchesAnyFilter("orders-worker-456", filters)).toBe(true);
    expect(matchesAnyFilter("notifications-789", filters)).toBe(false);
    expect(matchesAnyFilter("notifications-789", [])).toBe(true);
  });

  test("collapses deployment replicas into one service name", () => {
    expect(deriveServiceNameFromPod(
      "deployment-omn-wss-chat-gateway-7b67494cf7-9frvb"
    )).toBe("service-omn-wss-chat-gateway");
    expect(deriveServiceNameFromPod(
      "deployment-omn-wss-chat-gateway-7b67494cf7-lw8cj"
    )).toBe("service-omn-wss-chat-gateway");
  });
});
