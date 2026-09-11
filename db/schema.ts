import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    usernameNormalized: text('username_normalized').notNull(),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    passwordIterations: integer('password_iterations').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_accounts_username_normalized').on(table.usernameNormalized),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    accountId: text('account_id').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [index('idx_sessions_account_id').on(table.accountId)],
);

export const characters = sqliteTable(
  'characters',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    name: text('name').notNull(),
    sex: text('sex').notNull(),
    hairStyle: integer('hair_style').notNull(),
    hairColor: integer('hair_color').notNull(),
    worldJson: text('world_json').notNull(),
    automationRunning: integer('automation_running', { mode: 'boolean' })
      .notNull()
      .default(false),
    simulatedAt: integer('simulated_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_characters_name').on(table.name),
    index('idx_characters_account_id').on(table.accountId),
  ],
);
