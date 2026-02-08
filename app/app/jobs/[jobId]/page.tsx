"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { getSupabaseClient } from "@/lib/supabase";
import {
  loadImageFromFile,
  loadImageFromBlob,
  loadImageFromUrl,
  makeFramedBlob,
  makeContactSheetBlob,
} from "@/lib/image";
import { removeExtension, sanitizeFileName } from "@/lib/utils";

type JobRow = {
  id: string;
  client_id: string;
  frame_id: string | null;
  job_name: string;
  group_label: string | null;
  output_format: "jpg" | "png";
  output_quality: number;
  background_color: string;
  target_width: number;
  target_height: number;
  grid_cols: number;
  grid_rows: number;
  grid_cell_w: number;
  grid_cell_h: number;
  grid_gap: number;
  status: string;
  total_items: number;
  processed_items: number;
};

type FrameRow = {
  id: string;
  name: string;
  file_path: string;
};

type JobItemRow = {
  id: string;
  job_id: string;
  original_filename: string;
  student_label: string | null;
  status: string;
  framed_path: string | null;
  grid_path: string | null;
  error_message: string | null;
  created_at: string;
};

type ExportRow = {
  id: string;
  job_id: string;
  file_path: string;
  created_at: string;
};

type GridSource = {
  id: string;
  framedBlob: Blob;
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

export default function JobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const supabase = getSupabaseClient();
  const [job, setJob] = useState<JobRow | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [items, setItems] = useState<JobItemRow[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [contactSheetLoading, setContactSheetLoading] = useState(false);
  const pendingGridCount = items.filter(
    (item) => item.status === "done" && !item.grid_path,
  ).length;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    done: 0,
    total: 0,
  });
  const [deletingJob, setDeletingJob] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [exportsAvailable, setExportsAvailable] = useState(true);

  const fileMapRef = useRef<Map<string, File>>(new Map());
  const blobMapRef = useRef<Map<string, { framed: Blob }>>(new Map());

  const jobPreset = useMemo(() => {
    if (!job) return null;
    return {
      output_format: job.output_format,
      output_quality: job.output_quality,
      background_color: job.background_color,
      target_width: job.target_width,
      target_height: job.target_height,
      grid_cols: job.grid_cols,
      grid_rows: job.grid_rows,
      grid_cell_w: job.grid_cell_w,
      grid_cell_h: job.grid_cell_h,
      grid_gap: job.grid_gap,
    };
  }, [job]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobError) {
      setError(jobError.message);
      setLoading(false);
      return;
    }
    setJob(jobData as JobRow);

    const { data: itemsData, error: itemsError } = await supabase
      .from("job_items")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    if (itemsError) {
      setError(itemsError.message);
    } else {
      setItems((itemsData ?? []) as JobItemRow[]);
    }

    const { data: exportsData, error: exportsError } = await supabase
      .from("job_exports")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (exportsError) {
      setExportsAvailable(false);
      setExports([]);
    } else {
      const normalized = ((exportsData ?? []) as Record<string, unknown>[]).map(
        (row) =>
          ({
            ...row,
            file_path: resolveExportPath(row),
          }) as ExportRow,
      );
      setExports(normalized.filter((row) => row.file_path));
      setExportsAvailable(true);
    }

    if (jobData?.frame_id) {
      const { data: frameData, error: frameError } = await supabase
        .from("frames")
        .select("*")
        .eq("id", jobData.frame_id ?? "")
        .single();
      if (frameError) {
        setError(frameError.message);
      } else if (frameData) {
        const { data: signed, error: signedError } = await supabase.storage
          .from("frames")
          .createSignedUrl((frameData as FrameRow).file_path, 60 * 60);
        if (signedError) {
          setError(signedError.message);
        } else {
          setFrameUrl(signed.signedUrl);
        }
      }
    }

    setLoading(false);
  }, [jobId, supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    const newItems: JobItemRow[] = [];
    let done = 0;
    for (const file of Array.from(files)) {
      const { data, error } = await supabase
        .from("job_items")
        .insert({
          job_id: jobId,
          original_filename: file.name,
          status: "pending",
        })
        .select()
        .single();
      if (error) {
        setError(error.message);
        continue;
      }
      const item = data as JobItemRow;
      newItems.push(item);
      fileMapRef.current.set(item.id, file);
      done += 1;
      setUploadProgress({ done, total: files.length });
    }

    if (newItems.length > 0) {
      const total = items.length + newItems.length;
      await supabase
        .from("jobs")
        .update({ total_items: total })
        .eq("id", jobId);
      setItems((prev) => [...prev, ...newItems]);
      setJob((prev) => (prev ? { ...prev, total_items: total } : prev));
    }
    setUploading(false);
  };

  const updateItemState = (itemId: string, patch: Partial<JobItemRow>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const tryInsertExport = async (path: string) => {
    if (!exportsAvailable) return null;

    const payloads: Record<string, unknown>[] = [
      { job_id: jobId, file_path: path },
      { job_id: jobId, zip_path: path },
      { job_id: jobId, export_path: path },
      { job_id: jobId, path },
      { job_id: jobId, output_path: path },
    ];

    for (const payload of payloads) {
      const { data, error } = await supabase
        .from("job_exports")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        const row = data as Record<string, unknown>;
        const normalized = {
          ...row,
          file_path: resolveExportPath(row),
        } as ExportRow;
        return normalized.file_path ? normalized : null;
      }
    }

    setExportsAvailable(false);
    return null;
  };

  const assignGridBatches = async (sources: GridSource[]) => {
    if (!jobPreset) return;

    const fullGroupCount = Math.floor(sources.length / 3);
    for (let groupIndex = 0; groupIndex < fullGroupCount; groupIndex += 1) {
      const group = sources.slice(groupIndex * 3, groupIndex * 3 + 3);
      const images = await Promise.all(
        group.map((source) => loadImageFromBlob(source.framedBlob)),
      );
      const gridBlob = await makeContactSheetBlob(images, {
        ...jobPreset,
        grid_cols: 3,
        grid_rows: 3,
      });
      const gridPath = `${jobId}/grid_batch_${Date.now()}_${groupIndex + 1}.png`;
      const { error: uploadError } = await supabase.storage
        .from("outputs")
        .upload(gridPath, gridBlob, {
          upsert: true,
          contentType: "image/png",
        });
      if (uploadError) {
        throw uploadError;
      }

      const exportRow = await tryInsertExport(gridPath);
      if (exportRow) {
        setExports((prev) => [exportRow, ...prev]);
      }

      const ids = group.map((source) => source.id);
      await supabase
        .from("job_items")
        .update({ grid_path: gridPath })
        .in("id", ids);
      setItems((prev) =>
        prev.map((item) => (ids.includes(item.id) ? { ...item, grid_path: gridPath } : item)),
      );
    }

    const pendingRemainder = sources.length % 3;
    if (pendingRemainder > 0) {
      setError(
        `Quedaron ${pendingRemainder} estudiante(s) sin grid porque el lote requiere grupos de 3.`,
      );
    }
  };

  const processAll = async () => {
    if (!jobPreset || !job) return;
    setProcessing(true);
    setError(null);
    setProgress({ processed: 0, total: items.length });

    try {
      await supabase
        .from("jobs")
        .update({ status: "processing", processed_items: 0 })
        .eq("id", jobId);
      setJob((prev) => (prev ? { ...prev, status: "processing" } : prev));

      const frameImg = frameUrl ? await loadImageFromUrl(frameUrl) : null;
      let processedCount = 0;
      let failedCount = 0;
      const processedSources: GridSource[] = [];

      for (const item of items) {
        if (item.status !== "pending") continue;
        const file = fileMapRef.current.get(item.id);
        if (!file) continue;
        updateItemState(item.id, { status: "processing", error_message: null });
        await supabase
          .from("job_items")
          .update({ status: "processing" })
          .eq("id", item.id);

        try {
          const studentImg = await loadImageFromFile(file);
          const framedBlob = await makeFramedBlob(
            studentImg,
            frameImg,
            jobPreset,
          );

          const ext = job.output_format === "png" ? "png" : "jpg";
          const contentType =
            job.output_format === "png" ? "image/png" : "image/jpeg";
          const framedPath = `${jobId}/${item.id}_framed.${ext}`;

          const framedUpload = await supabase.storage
            .from("outputs")
            .upload(framedPath, framedBlob, {
              upsert: true,
              contentType,
            });

          if (framedUpload.error) {
            throw framedUpload.error;
          }

          await supabase
            .from("job_items")
            .update({
              framed_path: framedPath,
              grid_path: null,
              status: "done",
            })
            .eq("id", item.id);
          updateItemState(item.id, {
            framed_path: framedPath,
            status: "done",
          });
          blobMapRef.current.set(item.id, {
            framed: framedBlob,
          });

          processedSources.push({ id: item.id, framedBlob });
        } catch (err) {
          failedCount += 1;
          const message =
            err instanceof Error ? err.message : "Error al procesar.";
          await supabase
            .from("job_items")
            .update({ status: "failed", error_message: message })
            .eq("id", item.id);
          updateItemState(item.id, {
            status: "failed",
            error_message: message,
          });
        }

        processedCount += 1;
        setProgress((prev) => ({
          processed: processedCount,
          total: prev.total,
        }));
        await supabase
          .from("jobs")
          .update({ processed_items: processedCount })
          .eq("id", jobId);
        setJob((prev) =>
          prev ? { ...prev, processed_items: processedCount } : prev,
        );
      }

      const finalStatus = failedCount > 0 ? "failed" : "done";
      await supabase
        .from("jobs")
        .update({ status: finalStatus })
        .eq("id", jobId);
      setJob((prev) => (prev ? { ...prev, status: finalStatus } : prev));

      const { data: unassignedRows, error: unassignedError } = await supabase
        .from("job_items")
        .select("id, framed_path")
        .eq("job_id", jobId)
        .eq("status", "done")
        .is("grid_path", null)
        .order("created_at", { ascending: true });
      if (unassignedError) {
        throw unassignedError;
      }

      const missingSources: GridSource[] = [];
      for (const row of (unassignedRows ?? []) as { id: string; framed_path: string | null }[]) {
        if (!row.framed_path) continue;
        if (processedSources.find((source) => source.id === row.id)) continue;
        const framedBlob = await fetchSignedBlob(row.framed_path);
        missingSources.push({ id: row.id, framedBlob });
      }

      const allSources = [...processedSources, ...missingSources];
      if (allSources.length >= 3) {
        await assignGridBatches(allSources);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error general.";
      setError(message);
      await supabase
        .from("jobs")
        .update({ status: "failed", error_message: message })
        .eq("id", jobId);
      setJob((prev) => (prev ? { ...prev, status: "failed" } : prev));
    } finally {
      setProcessing(false);
    }
  };

  const downloadZip = async () => {
    if (!job) return;
    setDownloading(true);
    setError(null);
    try {
      const zip = new JSZip();
      const framedFolder = zip.folder("enmarcadas");
      const gridFolder = zip.folder("grid_3x3");
      const ext = job.output_format === "png" ? "png" : "jpg";

      const addedGridPaths = new Set<string>();
      for (const item of items) {
        if (!item.framed_path) continue;
        const baseName = sanitizeFileName(
          item.student_label || removeExtension(item.original_filename),
        );
        const cached = blobMapRef.current.get(item.id);

        const framedBlob = cached?.framed
          ? cached.framed
          : await fetchSignedBlob(item.framed_path);

        framedFolder?.file(`${baseName}_marco.${ext}`, framedBlob);

        if (item.grid_path && !addedGridPaths.has(item.grid_path)) {
          const gridBlob = await fetchSignedBlob(item.grid_path);
          gridFolder?.file(`grid_${item.id}.${ext}`, gridBlob);
          addedGridPaths.add(item.grid_path);
        }
      }

      const out = await zip.generateAsync({ type: "blob" });
      saveAs(out, `entrega_${jobId}.zip`);

      const zipPath = `${jobId}/entrega_${jobId}.zip`;
      const { error: uploadError } = await supabase.storage
        .from("zips")
        .upload(zipPath, out, {
          upsert: true,
          contentType: "application/zip",
        });
      if (!uploadError) {
        const exportRow = await tryInsertExport(zipPath);
        if (exportRow) {
          setExports((prev) => [exportRow, ...prev]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar ZIP.");
    } finally {
      setDownloading(false);
    }
  };

  const downloadExport = async (item: ExportRow) => {
    setDownloading(true);
    setError(null);
    try {
      const { data, error } = await supabase.storage
        .from("zips")
        .createSignedUrl(item.file_path, 60 * 5);
      if (error) throw error;
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("No se pudo descargar el zip.");
      const blob = await response.blob();
      const name = item.file_path.split("/").pop() || `entrega_${jobId}.zip`;
      saveAs(blob, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar.");
    } finally {
      setDownloading(false);
    }
  };

  const fetchSignedBlob = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("outputs")
      .createSignedUrl(path, 60 * 5);
    if (error) throw new Error(error.message);
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error("No se pudo descargar el archivo.");
    return await response.blob();
  };

  const generateContactSheet = async () => {
    if (!job || !jobPreset) return;
    const pendingGridItems = items.filter(
      (item) => item.status === "done" && !item.grid_path,
    );
    if (pendingGridItems.length < 3) {
      setError("Necesitas al menos 3 fotos procesadas para el collage 3x3.");
      return;
    }

    setContactSheetLoading(true);
    setError(null);

    try {
      const sources: GridSource[] = [];
      for (const item of pendingGridItems) {
        if (!item.framed_path) continue;
        const cached = blobMapRef.current.get(item.id);
        const framedBlob = cached?.framed
          ? cached.framed
          : await fetchSignedBlob(item.framed_path);
        sources.push({ id: item.id, framedBlob });
      }

      await assignGridBatches(sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el collage.");
    } finally {
      setContactSheetLoading(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    await handleFiles(event.dataTransfer.files);
  };

  const deleteJobAndAssets = async () => {
    if (!job) return;
    const confirmed = window.confirm(
      "Seguro? Esto elimina el job, items, outputs y zips.",
    );
    if (!confirmed) return;
    setDeletingJob(true);
    setError(null);
    try {
      const outputPaths: string[] = [];
      items.forEach((item) => {
        if (item.framed_path) outputPaths.push(item.framed_path);
        if (item.grid_path) outputPaths.push(item.grid_path);
      });
      const zipPaths = exports.map((exp) => exp.file_path);

      if (outputPaths.length > 0) {
        await supabase.storage.from("outputs").remove(outputPaths);
      }
      if (zipPaths.length > 0) {
        await supabase.storage.from("zips").remove(zipPaths);
      }

      await supabase.from("job_exports").delete().eq("job_id", jobId);
      await supabase.from("job_items").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);

      window.location.href = "/app";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeletingJob(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Trabajo
        </p>
        <h2 className="text-2xl font-semibold text-white">
          {job?.job_name ?? "..."}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Estado: {job?.status ?? "-"} · {job?.processed_items ?? 0}/
          {job?.total_items ?? 0}
        </p>
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)]">Cargando...</p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <h3 className="text-lg font-semibold text-white">Subir fotos</h3>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`mt-4 rounded-2xl border border-dashed px-6 py-10 text-center text-sm ${
            dragActive
              ? "border-[var(--accent)] bg-[var(--panel-strong)]"
              : "border-[var(--border)] bg-[var(--panel-strong)]"
          }`}
        >
          <p className="text-white">
            Arrastra y suelta tus fotos aqui
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Se cargan y se agregan automaticamente al job.
          </p>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFiles(e.target.files)}
            className="mt-4 text-xs text-[var(--muted)]"
          />
        </div>
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Subiendo items</span>
              <span>
                {uploadProgress.done}/{uploadProgress.total}
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-[var(--panel-strong)]">
              <div
                className="h-2 rounded-full bg-[var(--accent)] transition-all"
                style={{
                  width: `${Math.round(
                    (uploadProgress.done /
                      Math.max(uploadProgress.total, 1)) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {items.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Procesamiento</h3>
            <button
              onClick={processAll}
              disabled={processing}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60"
            >
              {processing ? "Procesando..." : "Procesar"}
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Progreso: {progress.processed} / {progress.total}
          </p>
        <div className="mt-3 h-2 w-full rounded-full bg-[var(--panel-strong)]">
          <div
            className="h-2 rounded-full bg-[var(--accent)] transition-all"
            style={{
              width: `${Math.round(
                (progress.processed / Math.max(progress.total, 1)) * 100,
              )}%`,
            }}
          />
        </div>
        {pendingGridCount >= 3 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={generateContactSheet}
              disabled={contactSheetLoading}
              className="rounded-full bg-[var(--panel-strong)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--panel)] disabled:opacity-60"
            >
              {contactSheetLoading ? "Armando grids..." : "Generar grids 3x3"}
            </button>
            <span className="text-xs text-[var(--muted)]">
              1 fila por estudiante, 3 estudiantes por grid.
            </span>
          </div>
        )}
      </section>
      )}

      {(job?.status === "done" || exports.length > 0) && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Descarga</h3>
            <button
              onClick={downloadZip}
              disabled={downloading}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-60"
            >
              {downloading ? "Generando..." : "Descargar ZIP"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Si el ZIP no está en memoria, se descargan los outputs desde Storage.
          </p>
        </section>
      )}

      {(job?.status === "done" || exports.length > 0) && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Zips del job</h3>
            <button
              onClick={deleteJobAndAssets}
              disabled={deletingJob}
              className="rounded-full border border-red-500/30 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
            >
              {deletingJob ? "Eliminando..." : "Borrar job y assets"}
            </button>
          </div>
          {exports.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Todavia no hay zips guardados para este job.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {exports.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-white">{item.file_path}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(item.created_at).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadExport(item)}
                    className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black"
                  >
                    Descargar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30">
        <h3 className="text-lg font-semibold text-white">Items</h3>
        <div className="mt-4 grid gap-3">
          {items.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Sin fotos cargadas.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">
                  {item.original_filename}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {item.status}
                </span>
              </div>
              {item.error_message && (
                <p className="mt-2 text-xs text-red-300">
                  {item.error_message}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
