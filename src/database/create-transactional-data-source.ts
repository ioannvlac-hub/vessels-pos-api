import { DataSource, DataSourceOptions } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

export async function createTransactionalDataSource(
  options?: DataSourceOptions,
): Promise<DataSource> {
  if (!options) {
    throw new Error('Invalid TypeORM options');
  }
  const dataSource = new DataSource(options);
  return addTransactionalDataSource(dataSource);
}
