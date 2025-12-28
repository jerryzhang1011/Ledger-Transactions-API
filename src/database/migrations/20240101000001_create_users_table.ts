import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).notNullable().unique();
    table.string('name', 255);
    table.string('avatar_url', 500);

    // OAuth provider info
    table.string('provider', 50).notNullable(); // 'google', 'github', etc.
    table.string('provider_id', 255).notNullable();

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    // Composite unique index for provider + provider_id
    table.unique(['provider', 'provider_id']);
  });

  // Index for email lookups
  await knex.schema.raw('CREATE INDEX idx_users_email ON users(email)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
