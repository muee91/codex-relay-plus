export type ExecFileResult = {
  readonly stderr: string;
  readonly stdout: string;
};

export type ExecFileRunner = (
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
) => Promise<ExecFileResult>;

export type ExecFileOptions = {
  readonly maxBuffer: number;
  readonly timeout: number;
};

type StartTailscaleServeInput = {
  /** @deprecated Retained only so older API callers fail deterministically without executing Tailscale. */
  readonly execFile?: ExecFileRunner;
  readonly url: string;
};

export type TailscaleServePreviewUrl = {
  readonly port: number;
  readonly sourceUrl: string;
};

export type TailscaleServeResult = {
  readonly port: number;
  readonly url: string;
};

export class TailscaleServeInvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TailscaleServeInvalidUrlError";
  }
}

export class TailscaleServeCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TailscaleServeCommandError";
  }
}

/**
 * @deprecated Tailscale is no longer a Codex Relay transport. This parser is
 * kept temporarily for wire compatibility with older mobile clients that may
 * still call the deprecated workspace preview endpoint.
 */
export function parseTailscaleServePreviewUrl(url: string): TailscaleServePreviewUrl {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new TailscaleServeInvalidUrlError("Preview URL must be a valid URL.");
  }

  if (parsedUrl.protocol !== "http:") {
    throw new TailscaleServeInvalidUrlError("Preview URL must use HTTP.");
  }
  if (!isLegacyTailscaleHost(parsedUrl.hostname)) {
    throw new TailscaleServeInvalidUrlError("Preview URL host must be a legacy Tailscale address.");
  }
  if (!parsedUrl.port) {
    throw new TailscaleServeInvalidUrlError("Preview URL must include an explicit port.");
  }

  const port = Number(parsedUrl.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TailscaleServeInvalidUrlError("Preview URL port must be between 1 and 65535.");
  }

  return {
    port,
    sourceUrl: parsedUrl.href,
  };
}

/**
 * @deprecated The endpoint remains only to give old clients a deterministic
 * upgrade error. It intentionally never shells out to the Tailscale CLI.
 */
export async function startTailscaleServeForPreviewUrl(
  input: StartTailscaleServeInput,
): Promise<TailscaleServeResult> {
  parseTailscaleServePreviewUrl(input.url);
  throw new TailscaleServeCommandError(
    "Tailscale Serve is no longer supported. Update the mobile app to use the built-in Tailcat transport.",
  );
}

function isLegacyTailscaleHost(host: string) {
  const normalized = host.toLowerCase();
  if (normalized.endsWith(".ts.net") || normalized.endsWith(".beta.tailscale.net")) {
    return true;
  }

  const octets = normalized.split(".").map(Number);
  return (
    octets.length === 4 &&
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) &&
    octets[0] === 100 &&
    octets[1] >= 64 &&
    octets[1] <= 127
  );
}
