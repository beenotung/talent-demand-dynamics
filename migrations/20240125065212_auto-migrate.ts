import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `job` add column `resolved_post_time` timestamp null')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `job` drop column `resolved_post_time`')
}
