const { getPodWorkloadIdentity } = require("./podWorkload");

function createPod(name, kind, ownerName, labels = {}) {
  return {
    metadata: {
      name,
      labels,
      ownerReferences: kind && ownerName
        ? [{ kind, name: ownerName, controller: true }]
        : [],
    },
  };
}

describe("getPodWorkloadIdentity", () => {
  test("groups ReplicaSets from different rollouts under the same Deployment", () => {
    const first = getPodWorkloadIdentity(createPod(
      "payments-7f8c9d4b6f-abcde",
      "ReplicaSet",
      "payments-7f8c9d4b6f",
      { "pod-template-hash": "7f8c9d4b6f" }
    ));
    const second = getPodWorkloadIdentity(createPod(
      "payments-6a7b8c9d5e-fghij",
      "ReplicaSet",
      "payments-6a7b8c9d5e",
      { "pod-template-hash": "6a7b8c9d5e" }
    ));

    expect(first).toEqual({ key: "Deployment/payments", displayName: "payments" });
    expect(second).toEqual(first);
  });

  test("groups StatefulSet replicas by their controller", () => {
    const first = getPodWorkloadIdentity(createPod("orders-0", "StatefulSet", "orders"));
    const second = getPodWorkloadIdentity(createPod("orders-1", "StatefulSet", "orders"));

    expect(first).toEqual({ key: "StatefulSet/orders", displayName: "orders" });
    expect(second).toEqual(first);
  });

  test("uses standard application labels when the pod has no controller", () => {
    const identity = getPodWorkloadIdentity(createPod(
      "standalone-pod",
      undefined,
      undefined,
      { "app.kubernetes.io/instance": "billing", "app.kubernetes.io/name": "api" }
    ));

    expect(identity).toEqual({ key: "Labels/billing/api", displayName: "billing" });
  });
});
