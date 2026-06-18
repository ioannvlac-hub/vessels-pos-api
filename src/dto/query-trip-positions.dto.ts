import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class QueryTripPositionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 50;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
