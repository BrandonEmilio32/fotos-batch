"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
      }
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al autenticar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-14 text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              MV Songs
            </p>
            <h1 className="text-2xl font-semibold text-white">
              {mode === "login" ? "Ingresar" : "Crear cuenta"}
            </h1>
          </div>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
            Access
          </span>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Administra tus trabajos de fotos escolares con estilo.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-white">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {loading
              ? "Procesando..."
              : mode === "login"
                ? "Ingresar"
                : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--muted)]">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="font-semibold text-white"
            >
              Crear cuenta nueva
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-semibold text-white"
            >
              Ya tengo cuenta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
