import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('benefit'))) {
    await knex.schema.createTable('benefit', table => {
      table.increments('id')
      table.text('benefit').notNullable().unique()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('content'))) {
    await knex.schema.createTable('content', table => {
      table.increments('id')
      table.text('html').notNullable()
      table.text('text').notNullable()
      table.timestamps(false, true)
    })
  }

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

  if (!(await knex.schema.hasTable('company_website'))) {
    await knex.schema.createTable('company_website', table => {
      table.increments('id')
      table.text('company_website').notNullable().unique()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('job_detail'))) {
    await knex.schema.createTable('job_detail', table => {
      table.increments('id')
      table.integer('description_id').unsigned().notNullable().references('content.id')
      table.integer('career_level_id').unsigned().nullable().references('career_level.id')
      table.integer('qualification_id').unsigned().nullable().references('qualification.id')
      table.integer('years_of_experience_id').unsigned().nullable().references('years_of_experience.id')
      table.integer('company_website_id').unsigned().nullable().references('company_website.id')
      table.integer('company_overview_id').unsigned().nullable().references('content.id')
      table.text('company_industry').nullable()
      table.text('benefits_and_others').nullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('company_benefit'))) {
    await knex.schema.createTable('company_benefit', table => {
      table.increments('id')
      table.integer('benefit_id').unsigned().notNullable().references('benefit.id')
      table.integer('job_detail_id').unsigned().notNullable().references('job_detail.id')
      table.timestamps(false, true)
    })
  }
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('company_benefit')
  await knex.schema.dropTableIfExists('job_detail')
  await knex.schema.dropTableIfExists('company_website')
  await knex.schema.dropTableIfExists('years_of_experience')
  await knex.schema.dropTableIfExists('qualification')
  await knex.schema.dropTableIfExists('career_level')
  await knex.schema.dropTableIfExists('content')
  await knex.schema.dropTableIfExists('benefit')
}
