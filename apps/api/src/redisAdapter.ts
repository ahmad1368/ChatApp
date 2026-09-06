import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

/**
 * Socket.io's default adapter only broadcasts within a single process, so
 * running more than one server instance behind a load balancer would mean
 * clients connected to different instances never see each other's messages.
 * The Redis adapter fixes that by sharing broadcasts through Redis pub/sub.
 *
 * Purely opt-in via REDIS_URL — this environment doesn't run Redis, and
 * requiring it would break local dev. Unset, the app behaves exactly as a
 * single-instance deployment always has.
 */
export async function createRedisAdapterIfConfigured() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined;

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (err) => console.error("Redis pub client error:", err));
  subClient.on("error", (err) => console.error("Redis sub client error:", err));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  console.log("Connected to Redis — Socket.io broadcasts will scale across instances");

  return createAdapter(pubClient, subClient);
}
