"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type FrameRow = {
  id: string;
  name: string;
};

export default function NewJobPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [jobName, setJobName] = useState("Trabajo escolar");
  const [groupLabel, setGroupLabel] = useState("");
  const [frameId, setFrameId] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<"jpg" | "png">("jpg");
  const [outputQuality, setOutputQuality] = useState(0.92);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [targetWidth, setTargetWidth] = useState(1200);
  const [targetHeight, setTargetHeight] = useState(1600);
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(3);
  const [gridCellW, setGridCellW] = useState(400);
  const [gridCellH, setGridCellH] = useState(400);
  const [gridGap, setGridGap] = useState(0);
  const aspectPresets = [
    {
      id: "2by3",
      label: "2:3 · 4000×6000",
      width: 4000,
      height: 6000,
    },
    {
      id: "3by4",
      label: "3:4 · 3000×4000",
      width: 3000,
      height: 4000,
    },
  ];

  const applyPreset = (preset: {
    width: number;
    height: number;
  }) => {
    setTargetWidth(preset.width);
    setTargetHeight(preset.height);
    setGridCols(3);
    setGridRows(3);
    setGridCellW(Math.floor(preset.width / 3));
    setGridCellH(Math.floor(preset.height / 3));
  };

  useEffect(() => {
    const loadFrames = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("frames")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true);
      if (error) setError(error.message);
      setFrames((data ?? []) as FrameRow[]);
      setLoading(false);
    };
    loadFrames();
  }, [clientId, supabase]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        client_id: clientId,
        frame_id: frameId,
        job_name: jobName,
        group_label: groupLabel || null,
        output_format: outputFormat,
        output_quality: outputQuality,
        background_color: backgroundColor,
        target_width: targetWidth,
        target_height: targetHeight,
        grid_cols: gridCols,
        grid_rows: gridRows,
        grid_cell_w: gridCellW,
        grid_cell_h: gridCellH,
        grid_gap: gridGap,
        status: "pending",
        total_items: 0,
        processed_items: 0,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
    } else if (data) {
      router.replace(`/app/jobs/${data.id}`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Nuevo trabajo
        </p>
        <h2 className="text-2xl font-semibold text-white">
          Configurar preset
        </h2>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-lg shadow-black/30">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-white">
            Relación de aspecto predeterminada
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {aspectPresets.map((preset) => {
            const active =
              targetWidth === preset.width &&
              targetHeight === preset.height;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--panel)] text-white shadow"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Collage 3x3: cada columna es la misma foto repetida 3 veces,
          mostrando toda la imagen (contain/letterbox). Si sobra espacio, el
          fondo neutro se encarga de rellenar.
        </p>
      </section>

      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg shadow-black/30"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-white">
              Nombre del trabajo
            </label>
            <input
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Grupo/Curso</label>
            <input
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Marco</label>
            <select
              value={frameId ?? ""}
              onChange={(e) =>
                setFrameId(e.target.value ? e.target.value : null)
              }
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            >
              <option value="">Sin marco</option>
              {frames.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.name}
                </option>
              ))}
            </select>
            {loading && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Cargando marcos...
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-white">
              Formato de salida
            </label>
            <select
              value={outputFormat}
              onChange={(e) =>
                setOutputFormat(e.target.value as "jpg" | "png")
              }
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            >
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-white">
              Calidad (0-1)
            </label>
            <input
              type="number"
              min="0.5"
              max="1"
              step="0.01"
              value={outputQuality}
              onChange={(e) => setOutputQuality(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">
              Color de fondo
            </label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Ancho final</label>
            <input
              type="number"
              value={targetWidth}
              onChange={(e) => setTargetWidth(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Alto final</label>
            <input
              type="number"
              value={targetHeight}
              onChange={(e) => setTargetHeight(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Grid cols</label>
            <input
              type="number"
              value={gridCols}
              onChange={(e) => setGridCols(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Grid rows</label>
            <input
              type="number"
              value={gridRows}
              onChange={(e) => setGridRows(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Cell width</label>
            <input
              type="number"
              value={gridCellW}
              onChange={(e) => setGridCellW(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Cell height</label>
            <input
              type="number"
              value={gridCellH}
              onChange={(e) => setGridCellH(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">Gap</label>
            <input
              type="number"
              value={gridGap}
              onChange={(e) => setGridGap(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Creando..." : "Crear trabajo"}
        </button>
      </form>
    </div>
  );
}
