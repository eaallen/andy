import type { ProvisionClaims } from "@/voshi/claims.js";
import { VoshiError } from "@/voshi/errors.js";

/**
 * PUTs each requested provision URL, course first, with the request's api token.
 * @param claims - Parsed provision claims.
 * @param fetchImpl - Fetch implementation (tests inject a mock).
 */
export async function finishProvision(
  claims: ProvisionClaims,
  fetchImpl: typeof fetch,
): Promise<void> {
  const urls = [claims.provisionContextUrl, claims.provisionLocationUrl].filter(
    (url): url is string => Boolean(url),
  );
  for (const url of urls) {
    const response = await fetchImpl(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${claims.apiToken}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new VoshiError(
        "Provisioning did not finish.",
        503,
        "voshi_provision_failed",
      );
    }
  }
}
