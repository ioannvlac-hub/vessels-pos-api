import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PositionsController } from './controllers/positions.controller';
import { createTransactionalDataSource } from './database/create-transactional-data-source';
import { PositionEntity } from './entities/position.entity';
import { PositionRepository } from './repositories/position.repository';
import { PositionsService } from './services/positions.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'better-sqlite3' as const,
        database: process.env.DB_PATH ?? 'positions.sqlite',
        entities: [PositionEntity],
        synchronize: true,
      }),
      dataSourceFactory: createTransactionalDataSource,
    }),
    TypeOrmModule.forFeature([PositionEntity]),
  ],
  controllers: [PositionsController],
  providers: [PositionsService, PositionRepository],
})
export class AppModule {}
