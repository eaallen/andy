export type VoshiErrorStatus = 401 | 404 | 422 | 503;

/**
 * Typed HTTP error for Voshi launch and grade routes.
 */
export class VoshiError extends Error {
  readonly status: VoshiErrorStatus;
  readonly code: string;

  /**
   * @param message - Human-readable error.
   * @param status - HTTP status.
   * @param code - Stable machine-readable code.
   */
  constructor(message: string, status: VoshiErrorStatus, code: string) {
    super(message);
    this.name = "VoshiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Returns true when `err` is a VoshiError.
 * @param err - Unknown thrown value.
 */
export function isVoshiError(err: unknown): err is VoshiError {
  return err instanceof VoshiError;
}
