import { redirect } from "next/navigation";
import { DEFAULT_ROOM_ID } from "@chatapp/shared";

export default function Home() {
  redirect(`/room/${DEFAULT_ROOM_ID}`);
}
