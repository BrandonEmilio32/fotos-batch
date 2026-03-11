"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type ClientRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

type JobRow = {
  id: string;
  client_id: string;
};

export default function EscuelasPage() {
  const supabase = getSupabaseClient();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: clientsData, error: clientsError }, { data: jobsData, error: jobsError }] =
      await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("jobs").select("id, client_id"),
      ]);

    if (clientsError || jobsError) {
      setError(clientsError?.message || jobsError?.message || "No se pudieron cargar las escuelas.");
    } else {
      setClients((clientsData ?? []) as ClientRow[]);
      setJobs((jobsData ?? []) as JobRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupsPerClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of jobs) {
      map.set(job.client_id, (map.get(job.client_id) ?? 0) + 1);
    }
    return map;
  }, [jobs]);

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => client.name.toLowerCase().includes(term));
  }, [clients, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Vista</p>
          <h2 className="text-2xl font-semibold text-white">Escuelas</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Gestiona las escuelas y entra a sus grupos y marcos.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar escuela"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2 text-sm text-white placeholder:text-[var(--muted)]"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Cargando escuelas...</p>}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {!loading && !error && filteredClients.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No se encontraron escuelas.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredClients.map((client) => {
          const groupCount = groupsPerClient.get(client.id) ?? 0;
          return (
            <Link
              key={client.id}
              href={`/app/clients/${client.id}`}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-sm shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-[var(--panel-strong)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Escuela</p>
                  <h3 className="mt-1 text-base font-semibold text-white group-hover:text-[var(--accent)]">
                    {client.name}
                  </h3>
                  {client.notes && (
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">{client.notes}</p>
                  )}
                </div>
                <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs text-[var(--muted)]">
                  {groupCount} grupo{groupCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>
                  Creada el {new Date(client.created_at).toLocaleDateString("es-ES")}
                </span>
                <span className="text-[var(--accent)]">Ver detalles →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
