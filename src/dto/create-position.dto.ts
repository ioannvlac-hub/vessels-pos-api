import {
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
    return 'receivedTimeUtc must not be in the future';
  }
}

export class CreatePositionDto {
  @IsNotEmpty({ message: 'vesselId is required' })
  @IsInt({ message: 'vesselId must be an integer' })
  @Min(1, { message: 'vesselId must be >= 1' })
  vesselId!: number;

  @IsNotEmpty({ message: 'receivedTimeUtc is required' })
  @IsISO8601(
    { strict: true },
    { message: 'receivedTimeUtc must be a valid ISO-8601 datetime' },
  )
  @Validate(IsNotInFutureConstraint)
  receivedTimeUtc!: string;

  @IsNotEmpty({ message: 'latitude is required' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'latitude must be a number' },
  )
  @Min(-90, { message: 'latitude must be >= -90' })
  @Max(90, { message: 'latitude must be <= 90' })
  latitude!: number;

  @IsNotEmpty({ message: 'longitude is required' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'longitude must be a number' },
  )
  @Min(-180, { message: 'longitude must be >= -180' })
  @Max(180, { message: 'longitude must be <= 180' })
  longitude!: number;
}
