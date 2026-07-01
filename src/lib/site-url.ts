import { clientEnv, serverEnv } from "@/lib/env";

export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    return clientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  return serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

export function challengeUrl(code: string): string {
  return `${getSiteUrl()}/challenge/${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function watchDuelUrl(duelId: string): string {
  return `${getSiteUrl()}/duels/${duelId}`;
}

export function watchLiveUrl(eventId: string): string {
  return `${getSiteUrl()}/live/${eventId}`;
}

export function watchSkillGameUrl(game: string, id: string): string {
  return `${getSiteUrl()}/games/duels/${game}/${id}`;
}

export function playerProfileUrl(username: string): string {
  return `${getSiteUrl()}/players/${encodeURIComponent(username)}`;
}
