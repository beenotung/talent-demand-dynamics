import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('job', table => {
    table.setNullable('location_id')
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('job', table => {
    table.dropNullable('location_id')
  })
}
