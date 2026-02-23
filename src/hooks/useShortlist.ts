import { useMemo, useState } from "react";
import { loadShortlist, saveShortlist } from "@/lib/storage";

export function useShortlist() {
  const [shortlist, setShortlist] = useState<string[]>(() => loadShortlist());

  const shortlistSet = useMemo(() => new Set(shortlist), [shortlist]);

  const toggle = (id: string) => {
    setShortlist((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      saveShortlist(next);
      return next;
    });
  };

  return {
    shortlist,
    shortlistSet,
    toggle,
  };
}
