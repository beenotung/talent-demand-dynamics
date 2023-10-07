import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `job` add column `post_time` timestamp not null')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `job` drop column `post_time`')
}
