"use client";

import { useCallback, useId, useEffect, useState } from "react";

export function FriendChallengeFields({
  stakeInputName = "stake",
}: {
  stakeInputName?: string;
}) {
  const friendlyId = useId();
  const [inviteDefault, setInviteDefault] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("challenge");
    if (code) setInviteDefault(code.trim().toUpperCase());
  }, []);

  const onFriendlyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const form = e.target.form;
      if (!form) return;
      const stakeEl = form.elements.namedItem(stakeInputName);
      if (!(stakeEl instanceof HTMLInputElement)) return;

      if (e.target.checked) {
        stakeEl.dataset.prevStake = stakeEl.value;
        stakeEl.value = "0";
        stakeEl.disabled = true;
        stakeEl.classList.add("opacity-40");
      } else {
        stakeEl.disabled = false;
        stakeEl.classList.remove("opacity-40");
        stakeEl.value = stakeEl.dataset.prevStake ?? "50";
      }
    },
    [stakeInputName],
  );

  return (
    <div className="mt-3 grid gap-3 sm:col-span-2">
      <label className="block">
        <span className="text-xs text-zinc-400">
          Challenge friend (player code or @username)
        </span>
        <input
          name="inviteCode"
          type="text"
          defaultValue={inviteDefault}
          placeholder="ABC12345 or @theirname — leave blank for anyone"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        />
      </label>
      <label
        htmlFor={friendlyId}
        className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300"
      >
        <input
          id={friendlyId}
          type="checkbox"
          name="friendly"
          value="true"
          className="mt-0.5 rounded"
          onChange={onFriendlyChange}
        />
        <span>
          <span className="text-sky-300">Friendly match</span> — free to play, no VIBE
          wager, no ELO change
        </span>
      </label>
    </div>
  );
}
