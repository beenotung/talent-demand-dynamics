import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('career_level'))) {
    await knex.schema.createTable('career_level', table => {
      table.increments('id')
      table.text('career_level').notNullable().unique()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('qualification'))) {
    await knex.schema.createTable('qualification', table => {
      table.increments('id')
      table.text('qualification').notNullable().unique()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('years_of_experience'))) {
    await knex.schema.createTable('years_of_experience', table => {
      table.increments('id')
      table.text('years_of_experience').notNullable().unique()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('job_detail'))) {
    await knex.schema.createTable('job_detail', table => {
      table.increments('id')
      table.integer('career_level_id').unsigned().nullable().references('career_level.id')
      table.integer('qualification_id').unsigned().nullable().references('qualification.id')
      table.integer('years_of_experience_id').unsigned().nullable().references('years_of_experience.id')
      table.timestamps(false, true)
    })
  }
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('job_detail')
  await knex.schema.dropTableIfExists('years_of_experience')
  await knex.schema.dropTableIfExists('qualification')
  await knex.schema.dropTableIfExists('career_level')
}
