import { test } from "node:test";
import assert from "node:assert/strict";
import { WeatherService, WeatherFetcher, isFarAway, FAR_AWAY_THRESHOLD_KM } from "./weather";

test("isFarAway() is false at and below the threshold", () => {
  assert.equal(isFarAway(FAR_AWAY_THRESHOLD_KM), false);
  assert.equal(isFarAway(FAR_AWAY_THRESHOLD_KM - 1), false);
});

test("isFarAway() is true above the threshold", () => {
  assert.equal(isFarAway(FAR_AWAY_THRESHOLD_KM + 1), true);
});

test("reports unconfigured when no API key is set", () => {
  const service = new WeatherService(undefined, async () => undefined);
  assert.equal(service.isConfigured(), false);
});

test("reports configured once an API key is set", () => {
  const service = new WeatherService("key", async () => undefined);
  assert.equal(service.isConfigured(), true);
});

test("getWeather returns undefined without calling the fetcher when unconfigured", async () => {
  let called = false;
  const fetcher: WeatherFetcher = async () => {
    called = true;
    return { tempCelsius: 20, description: "clear sky", icon: "01d" };
  };
  const service = new WeatherService(undefined, fetcher);
  assert.equal(await service.getWeather(10, 20), undefined);
  assert.equal(called, false);
});

test("getWeather passes coordinates and the api key through to the fetcher", async () => {
  let received: unknown;
  const fetcher: WeatherFetcher = async (lat, lon, apiKey) => {
    received = { lat, lon, apiKey };
    return { tempCelsius: 15, description: "light rain", icon: "10d" };
  };
  const service = new WeatherService("secret-key", fetcher);
  const weather = await service.getWeather(51.5, -0.1);
  assert.deepEqual(received, { lat: 51.5, lon: -0.1, apiKey: "secret-key" });
  assert.deepEqual(weather, { tempCelsius: 15, description: "light rain", icon: "10d" });
});

test("getWeather propagates a fetch failure as undefined", async () => {
  const service = new WeatherService("key", async () => undefined);
  assert.equal(await service.getWeather(0, 0), undefined);
});
