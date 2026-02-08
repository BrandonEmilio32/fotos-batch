"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type ClientRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

type ExportRow = {
  id: string;
  job_id: string;
  file_path: string;
  created_at: string;
};

function resolveExportPath(row: Record<string, unknown>) {
  const candidates = [
    row.file_path,
    row.zip_path,
    row.export_path,
    row.path,
    row.output_path,
  ];
  const found = candidates.find((value) => typeof value === "string");
  return (found as string | undefined) ?? "";
}

export default function ClientsPage() {
  const supabase = getSupabaseClient();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data, error }, { data: exportsData, error: exportsError }] =
      await Promise.all([
        supabase.from("clients").select("*").order("created_at", {
          ascending: false,
        }),
        supabase
          .from("job_exports")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
    if (error) {
      setError(error.message);
    } else {
      setClients((data ?? []) as ClientRow[]);
      if (!exportsError) {
        const normalized = ((exportsData ?? []) as Record<string, unknown>[]).map(
          (row) =>
            ({
              ...row,
              file_path: resolveExportPath(row),
            }) as ExportRow,
        );
        setExports(normalized.filter((row) => row.file_path));
      } else {
        setExports([]);
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const { error } = await supabase.from("clients").insert({
      name,
      notes: notes || null,
    });
    if (error) {
      setError(error.message);
    } else {
      setName("");
      setNotes("");
      loadClients();
    }
    setCreating(false);
  };

  const downloadExport = async (item: ExportRow) => {
    setDownloading(item.id);
    setError(null);
    try {
      const { data, error } = await supabase.storage
        .from("zips")
        .createSignedUrl(item.file_path, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar.");
    } finally {
      setDownloading(null);
    }
  };

  const deleteExport = async (item: ExportRow) => {
    setDeleting(item.id);
    setError(null);
    try {
      const { error: storageError } = await supabase.storage
        .from("zips")
        .remove([item.file_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase
        .from("job_exports")
        .delete()
        .eq("id", item.id);
      if (deleteError) throw deleteError;
      setExports((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Escuelas activas", value: clients.length, delta: "+3.5%" },
          { label: "Grupos recientes", value: 12, delta: "+11%" },
          { label: "Procesos hoy", value: 34, delta: "-2.4%" },
          { label: "Descargas", value: 18, delta: "+5.5%" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-lg shadow-black/30"
          >
            <div className="flex items-center justify-between">
              <p className="text-2xl font-semibold text-white">
                {stat.value}
              </p>
              <div className="rounded-xl bg-[var(--panel-strong)] px-3 py-2 text-xs text-[var(--accent)]">
                {stat.delta}
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Nueva escuela</h2>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
            New
          </span>
        </div>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4">
          <div>
            <label className="text-sm font-medium text-white">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
              rows={3}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60"
          >
            {creating ? "Guardando..." : "Crear escuela"}
          </button>
        </form>
        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Zips listos</h2>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
            Entregas
          </span>
        </div>
        {exports.length === 0 && !loading && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Todavia no hay zips guardados.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {exports.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">Job {item.job_id}</p>
                <p className="text-xs text-[var(--muted)]">{item.file_path}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadExport(item)}
                  disabled={downloading === item.id}
                  className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black disabled:opacity-60"
                >
                  {downloading === item.id ? "Descargando..." : "Descargar"}
                </button>
                <button
                  onClick={() => deleteExport(item)}
                  disabled={deleting === item.id}
                  className="rounded-full border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                >
                  {deleting === item.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Escuelas</h2>
          <button
            onClick={loadClients}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel-strong)]"
          >
            Recargar
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-[var(--muted)]">Cargando...</p>
        )}
        {!loading && error && (
          <p className="mt-4 text-sm text-red-300">{error}</p>
        )}
        {!loading && !error && clients.length === 0 && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No hay escuelas todavia.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/app/clients/${client.id}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--panel)]"
            >
              <div className="flex items-center justify-between">
                <span>{client.name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(client.created_at).toLocaleDateString("es-ES")}
                </span>
              </div>
              {client.notes && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {client.notes}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
