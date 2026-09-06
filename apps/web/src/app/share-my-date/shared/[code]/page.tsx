import SharedDateView from "./SharedDateView";

export default function SharedDatePage({ params }: { params: { code: string } }) {
  return <SharedDateView shareCode={params.code} />;
}
