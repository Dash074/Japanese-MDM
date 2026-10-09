import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSyncStatus, onSyncStatus, pendingAttempts, syncNow, type SyncStatus } from "../../lib/sync";
import { useProgress } from "../../lib/progress";
import { backendEnabled, supabase } from "../../lib/supabase";
import { Button, Card } from "../../ui/primitives";

/** アカウント — sign-in (magic link / Google) and sync status (FR-01, NFR-04). */
export function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus);
  const pending = useProgress((s) => pendingAttempts(s.log).length + s.dirtyCards.length);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    const off = onSyncStatus(setSync);
    return () => {
      data.subscription.unsubscribe();
      off();
    };
  }, []);

  if (!backendEnabled)
    return (
      <Card className="space-y-1">
        <h2 className="font-bold">アカウント · Account</h2>
        <p className="text-sm text-ink-muted">
          Cloud sync isn't configured, so progress is saved in this browser only. To enable accounts, add <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code>.
        </p>
      </Card>
    );

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/settings" } });
    if (error) setError(error.message);
    else setSent(true);
  };
  const google = async () => {
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/settings" } });
    if (error) setError(error.message);
  };

  return (
    <Card className="space-y-3">
      <h2 className="font-bold">アカウント · Account</h2>
      {user ? (
        <>
          <p className="text-sm">
            Signed in as <b>{user.email}</b>
          </p>
          <p className="text-sm text-ink-muted" role="status">
            {sync.state === "syncing" && "Syncing…"}
            {sync.state === "error" && <span className="text-shu">Sync failed: {sync.message}</span>}
            {sync.state === "idle" && (sync.lastSync ? `Synced ${new Date(sync.lastSync).toLocaleTimeString()}` : "Not synced yet")}
            {pending > 0 && ` · ${pending} change${pending > 1 ? "s" : ""} waiting`}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => void syncNow()} disabled={sync.state === "syncing"}>↻ Sync now</Button>
            <Button variant="quiet" onClick={() => void supabase!.auth.signOut()}>Sign out</Button>
          </div>
        </>
      ) : sent ? (
        <p className="text-sm">Check <b>{email}</b> for a sign-in link.</p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">Sign in to keep your progress across devices. Practice done before signing in is uploaded too.</p>
          <form onSubmit={sendLink} className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              className="min-w-0 flex-1 rounded-sm border border-grid bg-bg px-3 py-2 text-sm"
            />
            <Button variant="primary" type="submit">Email me a link</Button>
          </form>
          <Button onClick={google}>Continue with Google</Button>
        </>
      )}
      {error && <p className="text-sm text-shu">{error}</p>}
    </Card>
  );
}
