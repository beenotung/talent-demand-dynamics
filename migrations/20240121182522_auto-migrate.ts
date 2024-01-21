import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  {
    const rows = await knex.select('id', 'slug').from('job')
    await knex.raw('alter table `job` drop column `slug`')
    await knex.raw("alter table `job` add column `slug` text null")
    for (let row of rows) {
      await knex('job').update({ slug: row.slug }).where({ id: row.id })
    }
  }
}


export async function down(knex: Knex): Promise<void> {
  // FIXME: alter column (job.slug) to be non-nullable not supported in sqlite
  // you may set it to be non-nullable with sqlite browser manually
}
