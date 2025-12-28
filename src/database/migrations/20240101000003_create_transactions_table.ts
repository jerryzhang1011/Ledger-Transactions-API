import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create transaction type enum
  await knex.schema.raw(`
    CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER');
  `);

  // Create transaction status enum
  await knex.schema.raw(`
    CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
  `);

  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Transaction type and status
    table.specificType('type', 'transaction_type').notNullable();
    table.specificType('status', 'transaction_status').notNullable().defaultTo('PENDING');

    // Amount in smallest unit (cents)
    table.bigInteger('amount').notNullable();

    // Currency (denormalized for performance)
    table.specificType('currency', 'currency_type').notNullable();

    // Account references
    table.uuid('from_account_id').references('id').inTable('accounts').onDelete('SET NULL');
    table.uuid('to_account_id').references('id').inTable('accounts').onDelete('SET NULL');

    // Optional description/memo
    table.string('description', 500);

    // Reference ID for external systems
    table.string('reference_id', 255);

    // Idempotency key to prevent duplicate transactions
    table.string('idempotency_key', 255).unique();

    // Metadata (JSON for flexibility)
    table.jsonb('metadata').defaultTo('{}');

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('completed_at');
  });

  // Indexes for common queries
  await knex.schema.raw('CREATE INDEX idx_transactions_from_account ON transactions(from_account_id)');
  await knex.schema.raw('CREATE INDEX idx_transactions_to_account ON transactions(to_account_id)');
  await knex.schema.raw('CREATE INDEX idx_transactions_status ON transactions(status)');
  await knex.schema.raw('CREATE INDEX idx_transactions_type ON transactions(type)');
  await knex.schema.raw('CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC)');
  await knex.schema.raw('CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL');

  // Composite index for account transaction history
  await knex.schema.raw('CREATE INDEX idx_transactions_account_history ON transactions(from_account_id, created_at DESC)');

  // Constraint: amount must be positive
  await knex.schema.raw('ALTER TABLE transactions ADD CONSTRAINT chk_amount_positive CHECK (amount > 0)');

  // Constraint: transfers must have both from and to accounts
  await knex.schema.raw(`
    ALTER TABLE transactions ADD CONSTRAINT chk_transfer_accounts 
    CHECK (
      (type != 'TRANSFER') OR 
      (type = 'TRANSFER' AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL)
    )
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.raw('DROP TYPE IF EXISTS transaction_status');
  await knex.schema.raw('DROP TYPE IF EXISTS transaction_type');
}
