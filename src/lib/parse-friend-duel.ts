import { z } from "zod";

const stakeSchema = z.coerce.number().int().min(0).max(10_000);

export function parseFriendDuelFields(formData: FormData) {
  const inviteRaw = String(formData.get("inviteCode") ?? "").trim();
  const friendly = formData.get("friendly") === "true";
  const stakeRaw = stakeSchema.parse(formData.get("stake"));
  const stake = friendly ? 0 : stakeRaw;
  if (!friendly && (stake < 10 || stake > 10_000)) {
    throw new Error("Stake must be 10–10,000 VIBE for ranked duels.");
  }
  return {
    inviteCode: inviteRaw.length > 0 ? inviteRaw : null,
    friendly,
    stake,
  };
}
