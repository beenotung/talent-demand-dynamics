import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('word', table => {
    table.index(['is_tech'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('word', table => {
    table.dropIndex(['is_tech'])
  })
}
