import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { PositionEntity } from '../entities/position.entity';
import { IInsertSummary, IPositionRow } from '../types/interfaces';

@Injectable()
export class PositionRepository {
  constructor(
    @InjectRepository(PositionEntity)
    private readonly repository: Repository<PositionEntity>,
  ) {}

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
