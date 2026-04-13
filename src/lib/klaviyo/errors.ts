/**
 * Klaviyo API error classes.
 * None of these ever include the API key in the error message.
 */

export class KlaviyoError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null = null
  ) {
    super(message);
    this.name = "KlaviyoError";
  }
}

/** 401 or 403 — invalid or expired API key. No retry. */
export class KlaviyoAuthError extends KlaviyoError {
  constructor(statusCode: number) {
    super("Invalid or expired Klaviyo API key", statusCode);
    this.name = "KlaviyoAuthError";
  }
}

/** 429 after all retries exhausted. */
export class KlaviyoRateLimitError extends KlaviyoError {
  constructor(retryAfterSeconds?: number) {
    super(
      `Klaviyo rate limit exceeded after 3 retries${
        retryAfterSeconds ? ` (retry-after: ${retryAfterSeconds}s)` : ""
      }`,
      429
    );
    this.name = "KlaviyoRateLimitError";
  }
}

/** 5xx after all retries exhausted. */
export class KlaviyoServerError extends KlaviyoError {
  constructor(statusCode: number) {
    super(`Klaviyo server error (${statusCode}) after 3 retries`, statusCode);
    this.name = "KlaviyoServerError";
  }
}

/** Other 4xx — bad request, invalid filter, etc. Bug in our code. No retry. */
export class KlaviyoClientError extends KlaviyoError {
  constructor(statusCode: number, detail?: string) {
    super(
      `Klaviyo client error (${statusCode})${detail ? `: ${detail}` : ""}`,
      statusCode
    );
    this.name = "KlaviyoClientError";
  }
}

/** Pagination safety limit exceeded. Prevents runaway loops from malformed links.next. */
export class KlaviyoPaginationLimitError extends KlaviyoError {
  constructor(endpoint: string, pageCount: number, maxPages: number) {
    super(
      `Klaviyo pagination limit exceeded on ${endpoint}: fetched ${pageCount} pages (max ${maxPages})`,
      0
    );
    this.name = "KlaviyoPaginationLimitError";
  }
}
