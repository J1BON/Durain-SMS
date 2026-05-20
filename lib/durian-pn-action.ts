import { DurianApiError, fetchDurian } from "./durian-api";
import { pnVariantsForDurianMsg } from "./durian-phone";

/** Try multiple `pn` shapes until Durian accepts passMobile / addBlack (905 = wrong format). */
export async function fetchDurianWithPnVariants(
  endpoint: "passMobile" | "addBlack",
  pnRaw: string,
  params: Record<string, string | number | undefined>,
): Promise<void> {
  const variants = pnVariantsForDurianMsg(pnRaw);
  let last905: DurianApiError | null = null;

  for (const pn of variants) {
    try {
      await fetchDurian(endpoint, { ...params, pn });
      return;
    } catch (err) {
      if (err instanceof DurianApiError) {
        if (err.apiCode === 905) {
          last905 = err;
          continue;
        }
        throw err;
      }
      throw err;
    }
  }

  throw (
    last905 ??
    new DurianApiError(905, "Invalid phone number", 400)
  );
}
