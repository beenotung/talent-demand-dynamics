import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('content', table => {
    table.renameColumn('content', 'text')
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('content', table => {
    table.renameColumn('text', 'content')
  })
}
