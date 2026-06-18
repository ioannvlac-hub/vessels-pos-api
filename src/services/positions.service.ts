import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreatePositionDto } from '../dto/create-position.dto';
import { QueryTripPositionsDto } from '../dto/query-trip-positions.dto';
import { PositionRepository } from '../repositories/position.repository';
import {
  coordinatesMatch,
  validateMovement,
} from '../utils/position-movement';
import {
  ICreatePositionError,
  ICreatePositionsResult,
  IIndexedItem,
  IPositionsPage,
  IVesselTripSummary,
} from '../types/interfaces';

const FIELD_LABELS: Record<string, string> = {
  vesselId: 'Vessel ID',
  receivedTimeUtc: 'Received time UTC',
  latitude: 'Latitude',
  longitude: 'Longitude',
};

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
   * Accepts one position or a batch.
   * Client requests (default): all-or-nothing — any error → 400, nothing inserted.
   * CSV ingest (`allowPartialSuccess`): valid rows inserted, invalid rows in `errors`.
   */
  async create(
    body: unknown,
    options: { allowPartialSuccess?: boolean } = {},
  ): Promise<ICreatePositionsResult> {
    const allowPartialSuccess = options.allowPartialSuccess ?? false;
    const items = this.parseRequestBody(body);
    const errors: ICreatePositionError[] = [];
    const validated: { index: number; dto: CreatePositionDto }[] = [];

    for (const { index, item } of items) {
      const reasons = await this.validateItem(item);
      if (reasons.length > 0) {
        errors.push({ index, reasons });
        continue;
      }

      const dto = plainToInstance(CreatePositionDto, item, {
        enableImplicitConversion: true,
      });
      const businessReasons = await this.validateBusinessRules(dto);
      if (businessReasons.length > 0) {
        errors.push({ index, reasons: businessReasons });
        continue;
      }

      validated.push({ index, dto });
    }

    const batchErrors = this.validateBatchRules(validated);
    const rejectedIndexes = new Set(batchErrors.map((entry) => entry.index));
    errors.push(...batchErrors);

    if (errors.length > 0 && !allowPartialSuccess) {
      throw new BadRequestException({
        received: items.length,
        inserted: 0,
        duplicates: 0,
        rejected: errors.length,
        errors,
        errorMessage: 'One or more positions failed validation',
      });
    }

    const validRows = validated
      .filter((entry) => !rejectedIndexes.has(entry.index))
      .map((entry) => entry.dto);

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
    const dto = plainToInstance(CreatePositionDto, item, {
      enableImplicitConversion: true,
    });
    const validationErrors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return this.flattenValidationErrors(validationErrors);
  }

  private formatValidationMessage(
    property: string,
    message: string,
  ): string {
    const label = FIELD_LABELS[property] ?? property;

    if (message.includes(label) || message.includes(property)) {
      return message.replaceAll(property, label);
    }

    if (message.startsWith('property ') && message.includes(' should not exist')) {
      const unknownField = message
        .replace('property ', '')
        .replace(' should not exist', '');
      return `Unknown field "${unknownField}" is not allowed`;
    }

    return `${label}: ${message}`;
  }

  private flattenValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(
          ...Object.values(error.constraints)
            .filter((message): message is string => typeof message === 'string')
            .map((message) => this.formatValidationMessage(error.property, message)),
        );
      }
      if (error.children && error.children.length > 0) {
        messages.push(...this.flattenValidationErrors(error.children));
      }
    }

    return messages;
  }

  private async validateBusinessRules(
    dto: CreatePositionDto,
  ): Promise<string[]> {
    const reasons: string[] = [];
    const candidate = {
      latitude: dto.latitude,
      longitude: dto.longitude,
      receivedTimeUtc: dto.receivedTimeUtc,
    };

    const existing = await this.positionRepository.findByVesselAndTime(
      dto.vesselId,
      dto.receivedTimeUtc,
    );

    if (existing && !coordinatesMatch(existing, dto)) {
      reasons.push(
        'A position for this vessel already exists at this time with different coordinates.',
      );
      return reasons;
    }

    const { previous, next } =
      await this.positionRepository.findNeighborPositions(
        dto.vesselId,
        dto.receivedTimeUtc,
      );

    if (previous) {
      const movementError = validateMovement(
        {
          latitude: previous.latitude,
          longitude: previous.longitude,
          receivedTimeUtc: previous.receivedTimeUtc,
        },
        candidate,
      );
      if (movementError) {
        reasons.push(`Compared to the earlier report: ${movementError}`);
      }
    }

    if (next) {
      const movementError = validateMovement(candidate, {
        latitude: next.latitude,
        longitude: next.longitude,
        receivedTimeUtc: next.receivedTimeUtc,
      });
      if (movementError) {
        reasons.push(`Compared to the later report: ${movementError}`);
      }
    }

    return reasons;
  }

  private validateBatchRules(
    items: { index: number; dto: CreatePositionDto }[],
  ): ICreatePositionError[] {
    const errors: ICreatePositionError[] = [];
    const byVessel = new Map<number, { index: number; dto: CreatePositionDto }[]>();

    for (const item of items) {
      const group = byVessel.get(item.dto.vesselId) ?? [];
      group.push(item);
      byVessel.set(item.dto.vesselId, group);
    }

    for (const group of byVessel.values()) {
      const sorted = [...group].sort((left, right) => {
        const byTime = left.dto.receivedTimeUtc.localeCompare(
          right.dto.receivedTimeUtc,
        );
        return byTime !== 0 ? byTime : left.index - right.index;
      });

      for (let i = 1; i < sorted.length; i += 1) {
        const previous = sorted[i - 1];
        const current = sorted[i];

        if (previous.dto.receivedTimeUtc === current.dto.receivedTimeUtc) {
          if (!coordinatesMatch(previous.dto, current.dto)) {
            errors.push({
              index: current.index,
              reasons: [
                'A position in this batch already uses this time with different coordinates.',
              ],
            });
          }
          continue;
        }

        const movementError = validateMovement(
          {
            latitude: previous.dto.latitude,
            longitude: previous.dto.longitude,
            receivedTimeUtc: previous.dto.receivedTimeUtc,
          },
          {
            latitude: current.dto.latitude,
            longitude: current.dto.longitude,
            receivedTimeUtc: current.dto.receivedTimeUtc,
          },
        );

        if (movementError) {
          errors.push({
            index: current.index,
            reasons: [
              `Compared to row ${previous.index + 1} in this batch: ${movementError}`,
            ],
          });
        }
      }
    }

    return errors;
  }
}
