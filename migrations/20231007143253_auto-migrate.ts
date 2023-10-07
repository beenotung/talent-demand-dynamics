import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `selling_point` add column `content` text not null')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `selling_point` drop column `content`')
}
