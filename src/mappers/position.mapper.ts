import { PositionEntity } from '../entities/position.entity';
import {
  IPosition,
  IVesselTrip,
  IVesselTripSummary,
} from '../types/interfaces';

export const toPosition = (entity: PositionEntity): IPosition => ({
  id: entity.id,
  vesselId: entity.vesselId,
  receivedTimeUtc: entity.receivedTimeUtc,
  latitude: entity.latitude,
  longitude: entity.longitude,
});

export const toVesselTrips = (entities: PositionEntity[]): IVesselTrip[] => {
  const trips = new Map<number, IPosition[]>();

  for (const entity of entities) {
    const positions = trips.get(entity.vesselId) ?? [];
    positions.push(toPosition(entity));
    trips.set(entity.vesselId, positions);
  }

  return [...trips.entries()].map(([vesselId, positions]) => ({
    vesselId,
    positions,
  }));
};

export const toVesselTripSummary = (
  vesselId: number,
  total: number,
  first: PositionEntity,
  last: PositionEntity,
): IVesselTripSummary => ({
  vesselId,
  total,
  firstPosition: toPosition(first),
  lastPosition: toPosition(last),
});
