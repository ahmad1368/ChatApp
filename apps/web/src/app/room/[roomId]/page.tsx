import ChatRoom from "../../ChatRoom";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <ChatRoom roomId={params.roomId} />;
}
