export const COMMUNITY_TERMS_VERSION = '2026-10-13';
export type BlockedUsers = Record<string, string>;
const blockKey = (uid: string) => `fishing-blocked-users:${uid}`;

export function readBlockedUsers(uid: string): BlockedUsers {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(blockKey(uid)) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([key, name]) => key !== uid && typeof name === 'string').slice(0, 500)) as BlockedUsers;
  } catch { return {}; }
}
export function saveBlockedUsers(uid: string, users: BlockedUsers) {
  localStorage.setItem(blockKey(uid), JSON.stringify(users));
}
