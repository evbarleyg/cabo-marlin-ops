import { useEffect, useMemo, useState } from "react";
import { type ZodSchema } from "zod";

interface UseDataFileState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useDataFile<T>(fileName: string, schema: ZodSchema<T>): UseDataFileState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const path = useMemo(() => {
    return `${import.meta.env.BASE_URL}data/${fileName}`;
  }, [fileName]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(path, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while loading ${fileName}`);
        }
        const raw = await response.json();
        const parsed = schema.parse(raw);
        if (!cancelled) {
          setData(parsed);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unexpected error";
          setError(message);
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [path, fileName, schema]);

  return { data, loading, error };
}
