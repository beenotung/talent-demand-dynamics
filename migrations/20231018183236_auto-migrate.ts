import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('word', table => {
    table.unique(['word'])
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('word', table => {
    table.dropUnique(['word'])
  })
}
