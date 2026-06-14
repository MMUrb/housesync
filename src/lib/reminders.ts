import { formatMoney } from "@/lib/format";

/** A friendly, non-awkward nudge the user can copy into WhatsApp etc. */
export function buildReminderMessage(
  name: string,
  amount: number,
  currency: string,
): string {
  const money = formatMoney(amount, currency);
  return `Hey ${name}, just a friendly reminder you owe ${money} for house bills on HouseSync whenever you get a chance. No rush, thank you! 🙏`;
}
