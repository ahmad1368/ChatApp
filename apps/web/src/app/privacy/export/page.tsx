import { Suspense } from "react";
import ExportData from "./ExportData";

export default function ExportDataPage() {
  return (
    <Suspense fallback={null}>
      <ExportData />
    </Suspense>
  );
}
