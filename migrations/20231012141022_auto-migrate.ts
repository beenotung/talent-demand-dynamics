import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('company_website'))) {
    await knex.schema.createTable('company_website', table => {
      table.increments('id')
      table.text('company_website').notNullable().unique()
      table.timestamps(false, true)
    })
  }
  await knex.raw('alter table `job_detail` add column `company_website_id` integer not null references `company_website`(`id`)')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `job_detail` drop column `company_website_id`')
  await knex.schema.dropTableIfExists('company_website')
}
