// Same interpolation model as the frontend prototype: a route's `path` is a polyline
// of [lat, lng] points, and a bus's `progress` (0..1) is where along that polyline it sits.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pointOnPath(path, progress) {
  const segments = path.length - 1;
  const scaled = Math.min(progress, 0.9999) * segments;
  const i = Math.floor(scaled);
  const t = scaled - i;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

function stopFraction(stops, stopOrder) {
  return stopOrder / (stops.length - 1);
}

// Rough ETA in minutes given the bus's current progress, its recent speed (progress/sec),
// and the target stop. Assumes forward travel only (progress wraps at 1 -> 0 each lap).
function estimateEtaMinutes({ progress, speedPerSecond, stops, targetStopOrder }) {
  if (!speedPerSecond || speedPerSecond <= 0) return null;

  const targetFraction = stopFraction(stops, targetStopOrder);
  let diff = targetFraction - progress;
  if (diff < 0) diff += 1; // bus needs to complete the loop first

  const seconds = diff / speedPerSecond;
  return Math.max(1, Math.round(seconds / 60));
}

module.exports = { pointOnPath, stopFraction, estimateEtaMinutes };
