import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create currency enum
  await knex.schema.raw(`
    CREATE TYPE currency_type AS ENUM ('USD', 'EUR', 'GBP', 'CNY', 'JPY');
  `);

  await knex.schema.createTable('accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');

    // Account info
    table.string('name', 100).notNullable().defaultTo('Default Account');
    table.specificType('currency', 'currency_type').notNullable().defaultTo('USD');

    // Balance stored in smallest unit (cents) to avoid floating point issues
    // Using BIGINT to support large values: max ~92 quadrillion cents = 920 trillion dollars
    table.bigInteger('balance').notNullable().defaultTo(0);

    // Optimistic locking version for concurrency control
    table.integer('version').notNullable().defaultTo(1);

    // Soft delete
    table.boolean('is_active').notNullable().defaultTo(true);

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Indexes
  await knex.schema.raw('CREATE INDEX idx_accounts_user_id ON accounts(user_id)');
  await knex.schema.raw('CREATE INDEX idx_accounts_user_active ON accounts(user_id, is_active)');

  // Constraint to prevent negative balance
  await knex.schema.raw('ALTER TABLE accounts ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('accounts');
  await knex.schema.raw('DROP TYPE IF EXISTS currency_type');
}
