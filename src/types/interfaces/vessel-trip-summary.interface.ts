import { IPosition } from './vessel-trip.interface';

export interface IVesselTripSummary {
  vesselId: number;
  total: number;
  firstPosition: IPosition;
  lastPosition: IPosition;
}
