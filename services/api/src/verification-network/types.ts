import type {
  VerificationNetworkAssertionRequest,
  VerificationNetworkConsentRequest,
  VerificationNetworkCorrectionRequest,
  VerificationNetworkQueryRequest,
  VerificationNetworkQueryResponse,
} from "@cobranzapp/contracts";
import type { TenantActor } from "../tenancy/types.js";

export type VerificationNetworkServiceResult<T> =
  | { status: "ok"; value: T }
  | { status: "disabled" }
  | { status: "not_found" }
  | { status: "no_consent" };

export type VerificationNetworkConsentResult = {
  id: string;
  expiresAt: string;
  policyVersion: string;
  purpose: VerificationNetworkConsentRequest["purpose"];
  consentToken: string;
};

export type VerificationNetworkAssertionResult = {
  id: string;
  category: VerificationNetworkAssertionRequest["category"];
  status: "active";
  expiresAt: string;
};

export type VerificationNetworkCorrectionResult = { id: string; status: "open" };

export interface VerificationNetworkService {
  createConsent(
    actor: TenantActor,
    tenantId: string,
    input: VerificationNetworkConsentRequest & { requestId: string },
  ): Promise<VerificationNetworkServiceResult<VerificationNetworkConsentResult>>;
  revokeConsent(
    actor: TenantActor,
    tenantId: string,
    consentId: string,
    requestId: string,
  ): Promise<VerificationNetworkServiceResult<null>>;
  query(
    actor: TenantActor,
    tenantId: string,
    input: VerificationNetworkQueryRequest & { requestId: string },
  ): Promise<VerificationNetworkServiceResult<VerificationNetworkQueryResponse>>;
  publishAssertion(
    actor: TenantActor,
    tenantId: string,
    input: VerificationNetworkAssertionRequest & { requestId: string },
  ): Promise<VerificationNetworkServiceResult<VerificationNetworkAssertionResult>>;
  createCorrection(
    actor: TenantActor,
    tenantId: string,
    input: VerificationNetworkCorrectionRequest & { requestId: string },
  ): Promise<VerificationNetworkServiceResult<VerificationNetworkCorrectionResult>>;
}
