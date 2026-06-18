import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { PositionEntity } from '../entities/position.entity';
import { toPosition, toVesselTripSummary } from '../mappers/position.mapper';
import {
  IInsertSummary,
  IPositionFilters,
  IPositionRow,
  IPositionsPage,
  IVesselTripSummary,
} from '../types/interfaces';
import {
  applyRegionFilter,
  isOceanRegionName,
} from '../utils/ocean-regions';

interface IVesselStatsRow {
  vesselId: number;
  total: string;
  minTime: string;
  maxTime: string;
}

@Injectable()
export class PositionRepository {
  constructor(
    @InjectRepository(PositionEntity)
    private readonly repository: Repository<PositionEntity>,
  ) {}

  async findTripSummaries(): Promise<IVesselTripSummary[]> {
    const stats = await this.repository
      .createQueryBuilder('p')
      .select('p.vesselId', 'vesselId')
      .addSelect('COUNT(*)', 'total')
      .addSelect('MIN(p.receivedTimeUtc)', 'minTime')
      .addSelect('MAX(p.receivedTimeUtc)', 'maxTime')
      .groupBy('p.vesselId')
      .orderBy('p.vesselId', 'ASC')
      .getRawMany<IVesselStatsRow>();

    const summaries: IVesselTripSummary[] = [];

    for (const row of stats) {
      const vesselId = Number(row.vesselId);
      const total = Number(row.total);

      const first = await this.repository.findOne({
        where: { vesselId, receivedTimeUtc: row.minTime },
        order: { id: 'ASC' },
      });
      const last = await this.repository.findOne({
        where: { vesselId, receivedTimeUtc: row.maxTime },
        order: { id: 'DESC' },
      });

      if (!first || !last) {
        continue;
      }

      summaries.push(toVesselTripSummary(vesselId, total, first, last));
    }

    return summaries;
  }

  async findPositionsByVessel(
    vesselId: number,
    limit: number,
    offset: number,
    filters: IPositionFilters = {},
  ): Promise<IPositionsPage> {
    const qb = this.repository
      .createQueryBuilder('p')
      .where('p.vesselId = :vesselId', { vesselId });

    if (filters.from) {
      qb.andWhere('p.receivedTimeUtc >= :from', { from: filters.from });
    }

    if (filters.to) {
      qb.andWhere('p.receivedTimeUtc <= :to', { to: filters.to });
    }

    if (filters.region && isOceanRegionName(filters.region)) {
      applyRegionFilter(qb, filters.region);
    }

    const total = await qb.getCount();

    const entities = await qb
      .orderBy('p.receivedTimeUtc', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .take(limit)
      .skip(offset)
      .getMany();

    return {
      items: entities.map(toPosition),
      total,
      limit,
      offset,
    };
  }

  @Transactional()
  async insertManyIdempotent(rows: IPositionRow[]): Promise<IInsertSummary> {
    let inserted = 0;
    let duplicates = 0;

    for (const row of rows) {
      const exists = await this.repository.exists({
        where: {
          vesselId: row.vesselId,
          receivedTimeUtc: row.receivedTimeUtc,
        },
      });

      if (exists) {
        duplicates += 1;
        continue;
      }

      await this.repository.insert(row);
      inserted += 1;
    }

    return { inserted, duplicates };
  }
}
