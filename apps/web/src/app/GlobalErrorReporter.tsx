"use client";

import { useEffect } from "react";
import { installGlobalErrorReporting } from "./errorReporting";

export default function GlobalErrorReporter() {
  useEffect(() => installGlobalErrorReporting(), []);
  return null;
}
