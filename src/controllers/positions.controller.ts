import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ICreatePositionsResult } from '../types/interfaces';
import { PositionsService } from '../services/positions.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

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
