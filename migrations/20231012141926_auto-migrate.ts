import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('content'))) {
    await knex.schema.createTable('content', table => {
      table.increments('id')
      table.text('html').notNullable()
      table.text('content').notNullable()
      table.timestamps(false, true)
    })
  }
  await knex.raw('alter table `company` add column `overview_id` integer null references `content`(`id`)')
  await knex.raw('alter table `company` add column `industry` text null')
  await knex.raw('alter table `company` add column `benefits` text null')

  if (!(await knex.schema.hasTable('benefit'))) {
    await knex.schema.createTable('benefit', table => {
      table.increments('id')
      table.text('benefit').notNullable().unique()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('company_benefit'))) {
    await knex.schema.createTable('company_benefit', table => {
      table.increments('id')
      table.integer('company_id').unsigned().notNullable().references('company.id')
      table.integer('benefit_id').unsigned().notNullable().references('benefit.id')
      table.timestamps(false, true)
    })
  }
  await knex.raw('alter table `job_detail` add column `description_id` integer not null references `content`(`id`)')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `job_detail` drop column `description_id`')
  await knex.schema.dropTableIfExists('company_benefit')
  await knex.schema.dropTableIfExists('benefit')
  await knex.raw('alter table `company` drop column `benefits`')
  await knex.raw('alter table `company` drop column `industry`')
  await knex.raw('alter table `company` drop column `overview_id`')
  await knex.schema.dropTableIfExists('content')
}
