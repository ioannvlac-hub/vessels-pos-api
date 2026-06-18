import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { PositionsController } from '../src/controllers/positions.controller';
import { createTransactionalDataSource } from '../src/database/create-transactional-data-source';
import { PositionEntity } from '../src/entities/position.entity';
import { PositionRepository } from '../src/repositories/position.repository';
import { PositionsService } from '../src/services/positions.service';

describe('Positions (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    initializeTransactionalContext();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            type: 'better-sqlite3' as const,
            database: ':memory:',
            entities: [PositionEntity],
            synchronize: true,
          }),
          dataSourceFactory: createTransactionalDataSource,
        }),
        TypeOrmModule.forFeature([PositionEntity]),
      ],
      controllers: [PositionsController],
      providers: [PositionsService, PositionRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(PositionEntity).clear();
  });

  afterAll(async () => {
    await app.close();
  });

  const validPosition = {
    vesselId: 5091,
    receivedTimeUtc: '2017-12-20T22:59:12.000Z',
    latitude: 25.91658,
    longitude: -79.50869,
  };

  it('inserts a valid batch', async () => {
    const response = await request(app.getHttpServer())
      .post('/positions')
      .send([validPosition])
      .expect(201);

    expect(response.body).toMatchObject({
      received: 1,
      inserted: 1,
      duplicates: 0,
      rejected: 0,
      errors: [],
    });
  });

  it('treats a duplicate as idempotent', async () => {
    await request(app.getHttpServer())
      .post('/positions')
      .send([validPosition])
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/positions')
      .send([validPosition])
      .expect(201);

    expect(response.body).toMatchObject({
      received: 1,
      inserted: 0,
      duplicates: 1,
      rejected: 0,
      errors: [],
    });
  });

  it('rejects out-of-range latitude with a clear reason', async () => {
    const response = await request(app.getHttpServer())
      .post('/positions')
      .send([
        {
          ...validPosition,
          latitude: 107.06,
        },
      ])
      .expect(201);

    expect(response.body).toMatchObject({
      received: 1,
      inserted: 0,
      duplicates: 0,
      rejected: 1,
    });
    expect(response.body.errors[0].reasons.join(' ')).toMatch(/latitude/i);
  });

  it('returns 400 for an empty array', async () => {
    await request(app.getHttpServer())
      .post('/positions')
      .send([])
      .expect(400);
  });

  it('returns trip summaries and paginated positions', async () => {
    const positions = [
      validPosition,
      {
        ...validPosition,
        receivedTimeUtc: '2017-12-20T23:59:12.000Z',
        latitude: 26.0,
        longitude: -80.0,
      },
      {
        ...validPosition,
        receivedTimeUtc: '2017-12-21T00:59:12.000Z',
        latitude: 27.0,
        longitude: -81.0,
      },
    ];

    await request(app.getHttpServer()).post('/positions').send(positions).expect(201);

    const summaries = await request(app.getHttpServer())
      .get('/positions/trips')
      .expect(200);

    expect(summaries.body).toHaveLength(1);
    expect(summaries.body[0]).toMatchObject({
      vesselId: 5091,
      total: 3,
      firstPosition: {
        receivedTimeUtc: '2017-12-20T22:59:12.000Z',
        latitude: 25.91658,
      },
      lastPosition: {
        receivedTimeUtc: '2017-12-21T00:59:12.000Z',
        latitude: 27.0,
      },
    });
    expect(summaries.body[0].positions).toBeUndefined();

    const page = await request(app.getHttpServer())
      .get('/positions/trips/5091/positions')
      .query({ limit: 2, offset: 1 })
      .expect(200);

    expect(page.body).toMatchObject({
      total: 3,
      limit: 2,
      offset: 1,
    });
    expect(page.body.items).toHaveLength(2);
    expect(page.body.items[0].receivedTimeUtc).toBe('2017-12-20T23:59:12.000Z');
    expect(page.body.items[1].receivedTimeUtc).toBe('2017-12-21T00:59:12.000Z');
  });
});
