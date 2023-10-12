import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('company_industry'))) {
    await knex.schema.createTable('company_industry', table => {
      table.increments('id')
      table.text('company_industry').notNullable().unique()
      table.timestamps(false, true)
    })
  }
  await knex.schema.alterTable('job_detail', table => {
    table.foreign('id').references('job.id')
  })
  await knex.raw('alter table `job_detail` drop column `company_industry`')
  await knex.raw('alter table `job_detail` add column `company_industry_id` integer null references `company_industry`(`id`)')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `job_detail` drop column `company_industry_id`')
  await knex.raw('alter table `job_detail` add column `company_industry` text null')
  await knex.schema.alterTable('job_detail', table => {
    table.dropForeign('id')
  })
  await knex.schema.dropTableIfExists('company_industry')
}
