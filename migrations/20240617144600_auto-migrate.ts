import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `company` add column `profile_id` integer null references `content`(`id`)')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `company` drop column `profile_id`')
}
