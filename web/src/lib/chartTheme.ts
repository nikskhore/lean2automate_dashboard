import { useEffect, useState } from "react";

// Validated categorical palette (dataviz skill reference instance), fixed order.
export const CATEGORICAL_LIGHT = [
  "#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834",
];
export const CATEGORICAL_DARK = [
  "#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926",
];

// Income vs expense: categorical slots 2 (aqua→positive) and 6 (red→negative).
export const FLOW_COLORS = {
  light: { income: "#1baf7a", expense: "#e34948" },
  dark: { income: "#199e70", expense: "#e66767" },
};

// Chart chrome from the reference palette, matched to this app's surfaces.
export const CHROME = {
  light: { surface: "#ffffff", grid: "#e1e0d9", axis: "#c3c2b7", muted: "#898781", text: "#0b0b0b" },
  dark: { surface: "#111827", grid: "#2c2c2a", axis: "#383835", muted: "#898781", text: "#ffffff" },
};

/** Track the `.dark` class on <html> so charts re-theme on toggle. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Roll a category list down to top-N by value plus an aggregated "Other" slice. */
export function topNWithOther<T extends { name: string; total: string }>(
  items: T[],
  n: number,
): { name: string; value: number }[] {
  const sorted = [...items].sort((a, b) => Number(b.total) - Number(a.total));
  const top = sorted.slice(0, n).map((c) => ({ name: c.name, value: Number(c.total) }));
  const rest = sorted.slice(n);
  if (rest.length > 0) {
    top.push({ name: "Other", value: rest.reduce((s, c) => s + Number(c.total), 0) });
  }
  return top;
}
