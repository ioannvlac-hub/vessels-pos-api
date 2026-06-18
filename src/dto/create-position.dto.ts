import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isNotInFuture', async: false })
export class IsNotInFutureConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) {
      return false;
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return false;
    }
    return timestamp <= Date.now();
  }

  defaultMessage(): string {
    return 'Received time UTC must not be in the future';
  }
}

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return Number(value);
};

export class CreatePositionDto {
  @Transform(({ value }) => toOptionalNumber(value))
  @IsDefined({ message: 'Vessel ID is required' })
  @IsInt({ message: 'Vessel ID must be an integer' })
  @Min(1, { message: 'Vessel ID must be greater than or equal to 1' })
  vesselId!: number;

  @IsNotEmpty({ message: 'Received time UTC is required' })
  @IsISO8601(
    { strict: true },
    { message: 'Received time UTC must be a valid ISO-8601 datetime' },
  )
  @Validate(IsNotInFutureConstraint)
  receivedTimeUtc!: string;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsDefined({ message: 'Latitude is required' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Latitude must be a number' },
  )
  @Min(-90, { message: 'Latitude must be greater than or equal to -90' })
  @Max(90, { message: 'Latitude must be less than or equal to 90' })
  latitude!: number;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsDefined({ message: 'Longitude is required' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Longitude must be a number' },
  )
  @Min(-180, { message: 'Longitude must be greater than or equal to -180' })
  @Max(180, { message: 'Longitude must be less than or equal to 180' })
  longitude!: number;
}
