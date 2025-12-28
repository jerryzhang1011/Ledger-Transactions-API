import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data (in reverse order of foreign keys)
  await knex('transactions').del();
  await knex('accounts').del();
  await knex('users').del();

  // Insert test users
  const [user1, user2] = await knex('users')
    .insert([
      {
        email: 'alice@example.com',
        name: 'Alice Johnson',
        provider: 'google',
        provider_id: 'google-alice-123',
      },
      {
        email: 'bob@example.com',
        name: 'Bob Smith',
        provider: 'google',
        provider_id: 'google-bob-456',
      },
    ])
    .returning('*');

  // Insert accounts for users
  const [account1, account2] = await knex('accounts')
    .insert([
      {
        user_id: user1.id,
        name: 'Alice Checking',
        currency: 'USD',
        balance: 100000, // $1000.00 in cents
      },
      {
        user_id: user2.id,
        name: 'Bob Checking',
        currency: 'USD',
        balance: 50000, // $500.00 in cents
      },
    ])
    .returning('*');

  // Insert sample transactions
  await knex('transactions').insert([
    {
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: 100000,
      currency: 'USD',
      to_account_id: account1.id,
      description: 'Initial deposit',
      completed_at: new Date(),
    },
    {
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: 50000,
      currency: 'USD',
      to_account_id: account2.id,
      description: 'Initial deposit',
      completed_at: new Date(),
    },
    {
      type: 'TRANSFER',
      status: 'COMPLETED',
      amount: 10000, // $100.00
      currency: 'USD',
      from_account_id: account1.id,
      to_account_id: account2.id,
      description: 'Payment for lunch',
      completed_at: new Date(),
    },
  ]);

  console.log('Seed data inserted successfully');
}
