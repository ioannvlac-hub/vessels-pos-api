import { SelectQueryBuilder } from 'typeorm';
import { PositionEntity } from '../entities/position.entity';

export const OCEAN_REGION_NAMES = [
  'Arctic Ocean',
  'Southern Ocean',
  'North Atlantic',
  'South Atlantic',
  'North Pacific',
  'South Pacific',
  'Indian Ocean',
  'Mediterranean Sea',
  'South China Sea',
  'Gulf of Mexico',
  'Caribbean Sea',
  'Northern waters',
  'Southern waters',
] as const;

export type OceanRegionName = (typeof OCEAN_REGION_NAMES)[number];

export const isOceanRegionName = (value: string): value is OceanRegionName =>
  (OCEAN_REGION_NAMES as readonly string[]).includes(value);

export const applyRegionFilter = (
  qb: SelectQueryBuilder<PositionEntity>,
  region: OceanRegionName,
): void => {
  switch (region) {
    case 'Arctic Ocean':
      qb.andWhere('p.latitude > :arcticLat', { arcticLat: 66.5 });
      break;
    case 'Southern Ocean':
      qb.andWhere('p.latitude < :southernLat', { southernLat: -66.5 });
      break;
    case 'North Atlantic':
      qb.andWhere(
        'p.longitude >= :naLonMin AND p.longitude < :naLonMax AND p.latitude >= :naLatMin AND p.latitude <= :naLatMax',
        { naLonMin: -85, naLonMax: -30, naLatMin: 5, naLatMax: 45 },
      );
      break;
    case 'South Atlantic':
      qb.andWhere(
        'p.longitude >= :saLonMin AND p.longitude < :saLonMax AND p.latitude >= :saLatMin AND p.latitude < :saLatMax',
        { saLonMin: -60, saLonMax: -5, saLatMin: -55, saLatMax: 5 },
      );
      break;
    case 'North Pacific':
      qb.andWhere(
        '(p.longitude >= :npLonMin1 AND p.longitude < :npLonMax1 AND p.latitude >= :npLatMin AND p.latitude <= :npLatMax) OR (p.longitude >= :npLonMin2 AND p.longitude <= :npLonMax2 AND p.latitude >= :npLatMin AND p.latitude <= :npLatMax)',
        {
          npLonMin1: -170,
          npLonMax1: -60,
          npLonMin2: 120,
          npLonMax2: 180,
          npLatMin: 5,
          npLatMax: 70,
        },
      );
      break;
    case 'South Pacific':
      qb.andWhere(
        '(p.longitude >= :spLonMin1 AND p.longitude < :spLonMax1 AND p.latitude >= :spLatMin AND p.latitude < :spLatMax) OR (p.longitude >= :spLonMin2 AND p.longitude <= :spLonMax2 AND p.latitude >= :spLatMin AND p.latitude < :spLatMax)',
        {
          spLonMin1: -180,
          spLonMax1: -80,
          spLonMin2: 100,
          spLonMax2: 180,
          spLatMin: -55,
          spLatMax: 5,
        },
      );
      break;
    case 'Indian Ocean':
      qb.andWhere(
        'p.longitude >= :ioLonMin AND p.longitude < :ioLonMax AND p.latitude >= :ioLatMin AND p.latitude <= :ioLatMax',
        { ioLonMin: 40, ioLonMax: 120, ioLatMin: -30, ioLatMax: 30 },
      );
      break;
    case 'Mediterranean Sea':
      qb.andWhere(
        'p.longitude >= :medLonMin AND p.longitude < :medLonMax AND p.latitude >= :medLatMin AND p.latitude <= :medLatMax',
        { medLonMin: -10, medLonMax: 40, medLatMin: 30, medLatMax: 46 },
      );
      break;
    case 'South China Sea':
      qb.andWhere(
        'p.longitude >= :scsLonMin AND p.longitude < :scsLonMax AND p.latitude >= :scsLatMin AND p.latitude <= :scsLatMax',
        { scsLonMin: 100, scsLonMax: 130, scsLatMin: 0, scsLatMax: 45 },
      );
      break;
    case 'Gulf of Mexico':
      qb.andWhere(
        'p.longitude >= :gomLonMin AND p.longitude < :gomLonMax AND p.latitude >= :gomLatMin AND p.latitude <= :gomLatMax',
        { gomLonMin: -90, gomLonMax: -70, gomLatMin: 18, gomLatMax: 32 },
      );
      break;
    case 'Caribbean Sea':
      qb.andWhere(
        'p.longitude >= :carLonMin AND p.longitude < :carLonMax AND p.latitude >= :carLatMin AND p.latitude <= :carLatMax',
        { carLonMin: -82, carLonMax: -60, carLatMin: 20, carLatMax: 32 },
      );
      break;
    case 'Northern waters':
      qb.andWhere('p.latitude >= 0');
      break;
    case 'Southern waters':
      qb.andWhere('p.latitude < 0');
      break;
  }
};
