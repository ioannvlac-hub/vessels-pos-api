/** Maximum plausible distance between two reports (km), regardless of elapsed time. */
export const MAX_PLAUSIBLE_DISTANCE_KM = 50000;

const COORDINATE_EPSILON = 0.00001;
const EARTH_RADIUS_KM = 6371;

export interface IGeoPoint {
  latitude: number;
  longitude: number;
  receivedTimeUtc: string;
}

export const coordinatesMatch = (
  a: Pick<IGeoPoint, 'latitude' | 'longitude'>,
  b: Pick<IGeoPoint, 'latitude' | 'longitude'>,
): boolean =>
  Math.abs(a.latitude - b.latitude) < COORDINATE_EPSILON &&
  Math.abs(a.longitude - b.longitude) < COORDINATE_EPSILON;

export const distanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

export const maxAllowedDistanceKm = (_hoursApart: number): number =>
  MAX_PLAUSIBLE_DISTANCE_KM;

const formatDuration = (hoursApart: number): string => {
  if (hoursApart >= 48) {
    return `${(hoursApart / 24).toFixed(1)} days`;
  }

  if (hoursApart >= 24) {
    return `${(hoursApart / 24).toFixed(1)} day`;
  }

  return `${hoursApart.toFixed(1)} hours`;
};

export const validateMovement = (from: IGeoPoint, to: IGeoPoint): string | null => {
  const fromMs = Date.parse(from.receivedTimeUtc);
  const toMs = Date.parse(to.receivedTimeUtc);

  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return null;
  }

  const hoursApart = Math.abs(toMs - fromMs) / (1000 * 60 * 60);
  if (hoursApart === 0) {
    return null;
  }

  const travelledKm = distanceKm(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  const allowedKm = maxAllowedDistanceKm(hoursApart);

  if (travelledKm <= allowedKm) {
    return null;
  }

  return `The vessel could not travel ${travelledKm.toFixed(0)} km in ${formatDuration(hoursApart)}. The maximum plausible distance is ${allowedKm.toFixed(0)} km.`;
};
