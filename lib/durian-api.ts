export const DURIAN_API_BASE =
  "https://api.durianrcs.com/out/ext_api/";

export type DurianResponse<T = unknown> = {
  code: number;
  msg: string;
  data: T;
};

export class DurianApiError extends Error {
  constructor(
    public readonly apiCode: number,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "DurianApiError";
  }
}

export function getCredentials(): { username: string; apiKey: string } {
  const username = process.env.DURIAN_USERNAME;
  const apiKey = process.env.DURIAN_API_KEY;

  if (!username || !apiKey) {
    throw new DurianApiError(
      803,
      "Server credentials are not configured",
      500,
    );
  }

  return { username, apiKey };
}

export function buildDurianUrl(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): string {
  const { username, apiKey } = getCredentials();
  const url = new URL(endpoint, DURIAN_API_BASE);

  url.searchParams.set("name", username);
  url.searchParams.set("ApiKey", apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/** Maps Durian API business codes to HTTP status for the frontend proxy. */
export function mapApiCodeToHttpStatus(code: number): number {
  if (code === 200) return 200;

  switch (code) {
    case 403:
      return 400;
    case 802:
    case 803:
      return 401;
    case 800:
      return 403;
    case 902:
    case 903:
    case 904:
    case 905:
    case 906:
    case 907:
    case 400101:
    case 400102:
    case 400103:
    case 400906:
      return 400;
    case 406:
    case 200408:
      return 429;
    case 908:
      return 202;
    case 201:
    case 202:
    case 203:
      return 202;
    case 405:
    case 407:
      return 502;
    case 400:
      return 500;
    default:
      return code >= 400 && code < 600 ? code : 502;
  }
}

export function humanizeApiError(code: number, msg: string): string {
  const messages: Record<number, string> = {
    403: "Insufficient points on your account",
    800: "Account has been banned",
    802: "Invalid API credentials",
    803: "API credentials are missing",
    902: "Invalid request parameters",
    903: "Invalid country code",
    904: "Invalid project ID",
    905: "Invalid phone number",
    906: "No phone numbers available",
    908: "SMS not received yet — keep waiting",
    406: "Daily new-number limit reached",
    200408: "Number acquisition limit reached",
  };

  return messages[code] ?? msg ?? "Request failed";
}

export async function fetchDurian<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): Promise<{ data: T; raw: DurianResponse<T> }> {
  const url = buildDurianUrl(endpoint, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new DurianApiError(
      res.status,
      `Upstream request failed (${res.status})`,
      502,
    );
  }

  const raw = (await res.json()) as DurianResponse<T>;

  if (raw.code !== 200) {
    throw new DurianApiError(
      raw.code,
      humanizeApiError(raw.code, raw.msg),
      mapApiCodeToHttpStatus(raw.code),
    );
  }

  return { data: raw.data, raw };
}

export function parsePhoneData(data: string): string {
  const phone = data.split(",")[0]?.trim();
  return phone || data;
}

export type CountryStock = Record<string, number>;
