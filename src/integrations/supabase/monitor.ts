type QueryMethod = "select" | "insert" | "update" | "delete" | "upsert";

interface LogEntry {
  table: string;
  method: QueryMethod;
  status: number;
  durationMs: number;
  error?: any;
  dataSize?: number;
}

const logQueue: LogEntry[] = [];
let logTimer: ReturnType<typeof setTimeout> | null = null;

function flushLogs() {
  if (logQueue.length === 0) return;

  const grouped: Record<string, { ok: number; err: number; total: number; entries: LogEntry[] }> = {};
  for (const entry of logQueue) {
    const key = `${entry.table}:${entry.method}`;
    if (!grouped[key]) grouped[key] = { ok: 0, err: 0, total: 0, entries: [] };
    grouped[key].total++;
    if (entry.status >= 200 && entry.status < 300) grouped[key].ok++;
    else grouped[key].err++;
    grouped[key].entries.push(entry);
  }

  console.groupCollapsed(
    `%c📡 Supabase %c ${logQueue.length} call(s) %c ${logQueue.filter(e => e.status >= 200 && e.status < 300).length} ok, ${logQueue.filter(e => e.status < 200 || e.status >= 300).length} err`,
    "color:#3ECF8E;font-weight:bold",
    "color:#fff;background:#3ECF8E;padding:0 6px;border-radius:3px",
    "color:#888"
  );

  for (const [key, info] of Object.entries(grouped)) {
    console.groupCollapsed(
      `%c${key} %c ${info.ok}/${info.total} %c avg ${Math.round(info.entries.reduce((s, e) => s + e.durationMs, 0) / info.entries.length)}ms`,
      "font-weight:bold",
      info.err === 0 ? "color:#22C55E" : "color:#EF4444",
      "color:#888"
    );
    for (const entry of info.entries) {
      const methodColor =
        entry.method === "select" ? "#3B82F6" :
        entry.method === "insert" ? "#22C55E" :
        entry.method === "update" ? "#F59E0B" :
        entry.method === "delete" ? "#EF4444" : "#888";
      const statusColor = entry.status >= 200 && entry.status < 300 ? "#22C55E" : "#EF4444";

      console.log(
        `%c${entry.method.toUpperCase()}%c ${entry.status} %c${entry.durationMs}ms %c${entry.table}${entry.dataSize ? ` (${entry.dataSize} rows)` : ""}`,
        `color:${methodColor};font-weight:bold`,
        `color:${statusColor};font-weight:bold`,
        "color:#888",
        "color:inherit"
      );
      if (entry.error) {
        console.error("  ↳ Error:", entry.error);
      }
    }
    console.groupEnd();
  }
  console.groupEnd();

  logQueue.length = 0;
}

function enqueue(entry: LogEntry) {
  logQueue.push(entry);
  if (logTimer) clearTimeout(logTimer);
  logTimer = setTimeout(flushLogs, 100);
}

async function detectMethod(builder: any): Promise<QueryMethod> {
  // Check what methods have been called on this builder
  const stack = new Error().stack || "";
  // Default heuristic: look at what operation was chained
  if (stack.includes(".insert(")) return "insert";
  if (stack.includes(".update(")) return "update";
  if (stack.includes(".delete(")) return "delete";
  if (stack.includes(".upsert(")) return "upsert";
  return "select";
}

export function enableSupabaseMonitor(supabase: any) {
  const originalFrom = supabase.from.bind(supabase);

  supabase.from = (table: string) => {
    const builder = originalFrom(table);
    const originalThen = builder.then.bind(builder);

    builder.then = (resolve: Function, reject?: Function) => {
      const startTime = performance.now();

      return originalThen(
        (result: any) => {
          const durationMs = Math.round(performance.now() - startTime);

          let status = 0;
          let error = null;
          let dataSize = 0;

          // PostgREST responses carry status in various places
          if (result?.error) {
            status = result.error.status || result.error.code ? parseInt(result.error.code) : 500;
            error = result.error;
          } else if (result?.status !== undefined) {
            status = result.status;
          } else {
            // Successful select returns the data array directly
            status = 200;
          }

          if (Array.isArray(result)) {
            dataSize = result.length;
          } else if (result?.data && Array.isArray(result.data)) {
            dataSize = result.data.length;
          }

          // Detect method from the builder's internal state
          let method: QueryMethod = "select";
          if (builder._url) {
            const url = builder._url.toString();
            if (url.includes("/insert")) method = "insert";
            else if (url.includes("/update")) method = "update";
            else if (url.includes("/delete")) method = "delete";
          }

          enqueue({ table, method, status, durationMs, error, dataSize });

          return resolve(result);
        },
        (err: any) => {
          const durationMs = Math.round(performance.now() - startTime);
          enqueue({
            table,
            method: "select",
            status: err?.status || err?.code || 500,
            durationMs,
            error: err,
          });
          return reject ? reject(err) : console.error(err);
        }
      );
    };

    return builder;
  };

  console.log("%c🔍 Supabase Monitor active — all API calls logged to this panel", "color:#3ECF8E;font-weight:bold");
}
