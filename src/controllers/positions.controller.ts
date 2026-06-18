import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { QueryTripPositionsDto } from '../dto/query-trip-positions.dto';
import {
  ICreatePositionsResult,
  IPositionsPage,
  IVesselTripSummary,
} from '../types/interfaces';
import { PositionsService } from '../services/positions.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  /** Vessel trip summaries without loading every position. */
  @Get('trips')
  findTripSummaries(): Promise<IVesselTripSummary[]> {
    return this.positionsService.findTripSummaries();
  }

  /** Paginated positions for a single vessel trip. */
  @Get('trips/:vesselId/positions')
  findTripPositions(
    @Param('vesselId', ParseIntPipe) vesselId: number,
    @Query() query: QueryTripPositionsDto,
  ): Promise<IPositionsPage> {
    return this.positionsService.findTripPositions(vesselId, query);
  }

  /**
   * POST /positions — create one position or a batch.
   * Body is typed as `unknown`; validation happens per item in the service.
   */
  @Post()
  @HttpCode(201)
  create(@Body() body: unknown): Promise<ICreatePositionsResult> {
    return this.positionsService.create(body);
  }
}
