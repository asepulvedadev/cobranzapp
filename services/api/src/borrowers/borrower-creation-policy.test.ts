import { describe, expect, it } from "vitest";
import { borrowerCreationPolicy } from "./postgres-borrower-service.js";

describe("borrowerCreationPolicy", () => {
  it("auto-approves clients created by an owner or supervisor", () => {
    expect(borrowerCreationPolicy("owner")).toEqual({
      verificationState: "reviewed",
      approvalMode: "role_auto",
    });
    expect(borrowerCreationPolicy("supervisor")).toEqual({
      verificationState: "reviewed",
      approvalMode: "role_auto",
    });
  });

  it("keeps clients created by collectors pending", () => {
    expect(borrowerCreationPolicy("collector")).toEqual({
      verificationState: "manual_pending",
      approvalMode: null,
    });
  });
});
