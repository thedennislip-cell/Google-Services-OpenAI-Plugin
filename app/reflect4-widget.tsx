"use client";

import { useEffect } from "react";

export default function Reflect4Widget() {
  useEffect(() => {
    // Avoid injecting the widget script more than once if React re-runs effects.
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-id="r4-widget-connection"][src="https://www-reflect4.run.place/widget/widget.js"]'
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www-reflect4.run.place/widget/widget.js";
    script.async = true;
    script.dataset.id = "r4-widget-connection";
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return <div id="r4-widget-form" />;
}
