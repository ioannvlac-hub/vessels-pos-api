import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreatePositionDto } from '../dto/create-position.dto';
import { QueryTripPositionsDto } from '../dto/query-trip-positions.dto';
import { PositionRepository } from '../repositories/position.repository';
import {
  ICreatePositionError,
  ICreatePositionsResult,
  IIndexedItem,
  IPositionsPage,
  IVesselTripSummary,
} from '../types/interfaces';

@Injectable()
export class PositionsService {
  constructor(private readonly positionRepository: PositionRepository) {}

  findTripSummaries(): Promise<IVesselTripSummary[]> {
    return this.positionRepository.findTripSummaries();
  }

  findTripPositions(
    vesselId: number,
    query: QueryTripPositionsDto,
  ): Promise<IPositionsPage> {
    return this.positionRepository.findPositionsByVessel(
      vesselId,
      query.limit,
      query.offset,
      {
        from: query.from,
        to: query.to,
        region: query.region,
      },
    );
  }

  /**
   * Accepts one position or a batch. Each item is validated on its own:
   * valid rows are inserted, invalid rows are returned in `errors`.
   */
  async create(body: unknown): Promise<ICreatePositionsResult> {
    const items = this.parseRequestBody(body);
    const errors: ICreatePositionError[] = [];
    const validRows: CreatePositionDto[] = [];

    for (const { index, item } of items) {
      const reasons = await this.validateItem(item);
      if (reasons.length > 0) {
        errors.push({ index, reasons });
        continue;
      }
      validRows.push(plainToInstance(CreatePositionDto, item));
    }

    const { inserted, duplicates } =
      await this.positionRepository.insertManyIdempotent(
        validRows.map((dto) => ({
          vesselId: dto.vesselId,
          receivedTimeUtc: dto.receivedTimeUtc,
          latitude: dto.latitude,
          longitude: dto.longitude,
        })),
      );

    return {
      received: items.length,
      inserted,
      duplicates,
      rejected: errors.length,
      errors,
    };
  }

  /**
   * 400 only for structurally bad requests (empty body / empty array).
   * Bad rows inside a batch are handled separately in `create`.
   */
  private parseRequestBody(body: unknown): IIndexedItem[] {
    if (body === null || body === undefined) {
      throw new BadRequestException('Request body is required');
    }

    if (Array.isArray(body)) {
      if (body.length === 0) {
        throw new BadRequestException('Request body must not be an empty array');
      }
      return body.map((item, index) => ({ index, item }));
    }

    if (typeof body === 'object') {
      return [{ index: 0, item: body }];
    }

    throw new BadRequestException('Request body must be an object or array');
  }

  /**
   * Runs class-validator per item (not via global ValidationPipe),
   * so one bad row does not reject the whole batch.
   */
  private async validateItem(item: unknown): Promise<string[]> {
    const dto = plainToInstance(CreatePositionDto, item);
    const validationErrors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return this.flattenValidationErrors(validationErrors);
  }

  private flattenValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(
          ...Object.values(error.constraints).filter(
            (message): message is string => typeof message === 'string',
          ),
        );
      }
      if (error.children && error.children.length > 0) {
        messages.push(...this.flattenValidationErrors(error.children));
      }
    }

    return messages;
  }
}
