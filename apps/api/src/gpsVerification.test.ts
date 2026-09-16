import { test } from "node:test";
import assert from "node:assert/strict";
import { GpsVerificationService, IpLocationFetcher, MAX_DIVERGENCE_KM } from "./gpsVerification";

test("verify() is false when the IP location can't be determined", async () => {
  const fetcher: IpLocationFetcher = async () => undefined;
  const service = new GpsVerificationService(fetcher);
  const result = await service.verify({ lat: 40.7128, lng: -74.006 }, "1.2.3.4");
  assert.deepEqual(result, { verified: false, distanceKm: null, reason: "Could not determine your network location" });
});

test("verify() is true when GPS and IP locations are close together", async () => {
  const fetcher: IpLocationFetcher = async () => ({ lat: 40.71, lng: -74.0 });
  const service = new GpsVerificationService(fetcher);
  const result = await service.verify({ lat: 40.7128, lng: -74.006 }, "1.2.3.4");
  assert.equal(result.verified, true);
  assert.ok(result.distanceKm !== null && result.distanceKm < MAX_DIVERGENCE_KM);
});

test("verify() is false when GPS and IP locations are far apart (possible VPN)", async () => {
  const fetcher: IpLocationFetcher = async () => ({ lat: 51.5074, lng: -0.1278 }); // London
  const service = new GpsVerificationService(fetcher);
  const result = await service.verify({ lat: 40.7128, lng: -74.006 }, "1.2.3.4"); // New York
  assert.equal(result.verified, false);
  assert.ok(result.distanceKm !== null && result.distanceKm > MAX_DIVERGENCE_KM);
  assert.match(result.reason, /VPN/);
});

test("verify() passes the requester's ip through to the fetcher", async () => {
  let received: string | undefined;
  const fetcher: IpLocationFetcher = async (ip) => {
    received = ip;
    return { lat: 0, lng: 0 };
  };
  const service = new GpsVerificationService(fetcher);
  await service.verify({ lat: 0, lng: 0 }, "5.6.7.8");
  assert.equal(received, "5.6.7.8");
});
