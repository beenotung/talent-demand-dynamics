import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  {
    const rows = await knex.select('id', 'company_website_id').from('job_detail')
    await knex.schema.alterTable('job_detail', table => table.dropForeign(['company_website_id']))
    await knex.raw('alter table `job_detail` drop column `company_website_id`')
    await knex.raw("alter table `job_detail` add column `company_website_id` integer null references company_website(id)")
    for (let row of rows) {
      await knex('job_detail').update({ company_website_id: row.company_website_id }).where({ id: row.id })
    }
  }
}


export async function down(knex: Knex): Promise<void> {
  // FIXME: alter column (job_detail.company_website_id) to be non-nullable not supported in sqlite
  // you may set it to be non-nullable with sqlite browser manually
}
