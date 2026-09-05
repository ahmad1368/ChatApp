import SharedPlanView from "./SharedPlanView";

export default function SharedPlanPage({ params }: { params: { code: string } }) {
  return <SharedPlanView shareCode={params.code} />;
}
