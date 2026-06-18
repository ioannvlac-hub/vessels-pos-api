import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('positions')
@Unique('UQ_positions_vessel_received', ['vesselId', 'receivedTimeUtc'])
@Index('IDX_positions_vessel_received', ['vesselId', 'receivedTimeUtc'])
export class PositionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  vesselId!: number;

  @Column({ type: 'text' })
  receivedTimeUtc!: string;

  @Column({ type: 'real' })
  latitude!: number;

  @Column({ type: 'real' })
  longitude!: number;
}
