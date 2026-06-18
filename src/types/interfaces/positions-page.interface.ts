import { IPosition } from './vessel-trip.interface';

export interface IPositionsPage {
  items: IPosition[];
  total: number;
  limit: number;
  offset: number;
}
