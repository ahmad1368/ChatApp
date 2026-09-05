import SOSAlertView from "./SOSAlertView";

export default function SOSAlertPage({ params }: { params: { code: string } }) {
  return <SOSAlertView shareCode={params.code} />;
}
