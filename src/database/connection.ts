import knex, { Knex } from 'knex';
import { config } from '../config/index.js';

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: config.databaseUrl,
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './src/database/migrations',
  },
  seeds: {
    directory: './src/database/seeds',
  },
};

export const db = knex(knexConfig);

