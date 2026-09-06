import EntryGate from "../../EntryGate";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <EntryGate roomId={params.roomId} />;
}
