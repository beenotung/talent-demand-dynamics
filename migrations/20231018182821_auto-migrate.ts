import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('word'))) {
    await knex.schema.createTable('word', table => {
      table.increments('id')
      table.text('word').notNullable()
      table.boolean('is_tech').nullable()
      table.integer('job_count').notNullable()
      table.integer('company_count').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('company_word'))) {
    await knex.schema.createTable('company_word', table => {
      table.increments('id')
      table.integer('company_id').unsigned().notNullable().references('company.id')
      table.integer('word_id').unsigned().notNullable().references('word.id')
      table.timestamps(false, true)
    })
  }
  await knex.raw('alter table `job_detail` add column `has_count_word` boolean null')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `job_detail` drop column `has_count_word`')
  await knex.schema.dropTableIfExists('company_word')
  await knex.schema.dropTableIfExists('word')
}
