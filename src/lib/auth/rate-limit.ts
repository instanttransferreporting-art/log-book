// Limitation des tentatives de connexion (mémoire du processus : adaptée à une instance unique ;
// en multi-instances, remplacer par un stockage partagé type Redis).
// LOGIN_MAX_ATTEMPTS : nombre d'échecs avant blocage temporaire. 0 ou absent = aucune limite (choix du propriétaire).
const maxFails = () => Number(process.env.LOGIN_MAX_ATTEMPTS ?? 0) || 0;
const WINDOW_MS = 15 * 60 * 1000;
const store = new Map<string, { count: number; resetAt: number }>();

const key = (email: string, ip: string) => `${email.toLowerCase()}|${ip}`;

export function isLocked(email: string, ip: string, now = Date.now()) {
  if (!maxFails()) return false;
  const e = store.get(key(email, ip));
  if (!e) return false;
  if (e.resetAt <= now) { store.delete(key(email, ip)); return false; }
  return e.count >= maxFails();
}

export function recordFailure(email: string, ip: string, now = Date.now()) {
  if (!maxFails()) return;
  const k = key(email, ip);
  const e = store.get(k);
  if (!e || e.resetAt <= now) store.set(k, { count: 1, resetAt: now + WINDOW_MS });
  else e.count++;
}

export function resetFailures(email: string, ip: string) { store.delete(key(email, ip)); }
export function clearAllFailures() { store.clear(); }
