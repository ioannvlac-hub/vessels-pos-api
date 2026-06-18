import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ICreatePositionsResult, IVesselTrip } from '../types/interfaces';
import { PositionsService } from '../services/positions.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  /** All vessel trips — positions grouped by vessel, ordered by time. */
  @Get('trips')
  findTrips(): Promise<IVesselTrip[]> {
    return this.positionsService.findTrips();
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
