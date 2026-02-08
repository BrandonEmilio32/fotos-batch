"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <p className="text-sm text-[var(--muted)]">Cargando sesion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-[var(--border)] bg-[var(--panel-soft)] px-6 py-6 lg:flex">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                MV Songs
              </p>
              <h1 className="text-xl font-semibold text-white">
                Fotos batch
              </h1>
            </div>
            <div className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
              v1
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-[var(--panel)] p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--panel-strong)]" />
              <div>
                <p className="text-sm font-semibold">MV Songs</p>
                <p className="text-xs text-[var(--muted)]">Gold member</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 space-y-2 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              Navigation
            </p>
            <Link
              href="/app"
              className="flex items-center justify-between rounded-full bg-[var(--panel)] px-4 py-2 text-white shadow"
            >
              Dashboard
              <span className="text-xs text-[var(--muted)]">Clients</span>
            </Link>
            <Link
              href="/app"
              className="flex items-center justify-between rounded-full px-4 py-2 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-white"
            >
              Escuelas
              <span className="text-xs">Vista</span>
            </Link>
            <Link
              href="/app"
              className="flex items-center justify-between rounded-full px-4 py-2 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-white"
            >
              Grupos
              <span className="text-xs">Jobs</span>
            </Link>
          </nav>

          <div className="mt-auto pt-8">
            <button
              onClick={handleLogout}
              className="w-full rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--panel)] hover:text-white"
            >
              Salir
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-[var(--border)] bg-[var(--panel-soft)] px-6 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-1 items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-[var(--panel)]" />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
                      MV Songs
                    </span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                      Dashboard
                    </span>
                  </div>
                  <div className="mt-3 hidden md:block">
                    <input
                      placeholder="Search products"
                      className="w-full max-w-xl rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-white placeholder:text-[var(--muted)]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-full bg-[var(--panel)] px-4 py-2 text-xs font-semibold text-white">
                  + Create New Project
                </button>
                <div className="hidden items-center gap-2 md:flex">
                  <div className="h-8 w-8 rounded-lg bg-[var(--panel)]" />
                  <div className="h-8 w-8 rounded-lg bg-[var(--panel)]" />
                  <div className="h-8 w-8 rounded-lg bg-[var(--panel)]" />
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
