// Перевод широты/долготы в метры игрового мира (x — восток, z — юг).
export function makeGeo(lat0, lon0) {
  const mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  return {
    toXZ: (lat, lon) => ({ x: (lon - lon0) * mLon, z: -(lat - lat0) * mLat }),
    toLatLon: (x, z) => ({ lat: lat0 - z / mLat, lon: lon0 + x / mLon }),
  };
}
