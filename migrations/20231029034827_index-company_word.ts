import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('company_word', table => {
    table.unique(['word_id', 'company_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('company_word', table => {
    table.dropUnique(['word_id', 'company_id'])
  })
}
