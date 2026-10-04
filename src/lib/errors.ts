// Errors that map to HTTP statuses. Server actions turn them into
// { ok: false, status } results; pages turn them into notFound()/forbidden().

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 413 | 415 | 429,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Log in to continue.") {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "You do not have permission to do that.") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found.") {
    super(404, message);
  }
}
