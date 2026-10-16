import { describe, expect, it } from "vitest";
import { loanCreationPolicy } from "./postgres-credit-service.js";

describe("loan creation policy", () => {
  it("keeps collector-created credits pending approval", () => {
    expect(loanCreationPolicy("collector")).toEqual({
      status: "submitted",
      approvalMode: null,
      approvedByCreator: false,
    });
  });

  it.each(["owner", "supervisor"] as const)(
    "automatically approves credits created by %s",
    (role) => {
      expect(loanCreationPolicy(role)).toEqual({
        status: "active",
        approvalMode: "role_auto",
        approvedByCreator: true,
      });
    },
  );

  it("rejects roles outside credit operations", () => {
    expect(() => loanCreationPolicy("customer")).toThrow("UNSUPPORTED_LOAN_CREATOR_ROLE");
  });
});
