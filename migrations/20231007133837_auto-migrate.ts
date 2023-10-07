import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('ad_type'))) {
    await knex.schema.createTable('ad_type', table => {
      table.increments('id')
      table.text('type').notNullable().unique()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('company'))) {
    await knex.schema.createTable('company', table => {
      table.increments('id')
      table.text('slug').notNullable()
      table.text('name').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('location'))) {
    await knex.schema.createTable('location', table => {
      table.increments('id')
      table.text('slug').notNullable().unique()
      table.text('name').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('job'))) {
    await knex.schema.createTable('job', table => {
      table.increments('id')
      table.integer('ad_type_id').unsigned().notNullable().references('ad_type.id')
      table.text('slug').notNullable()
      table.text('title').notNullable()
      table.integer('company_id').unsigned().notNullable().references('company.id')
      table.integer('location_id').unsigned().notNullable().references('location.id')
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('selling_point'))) {
    await knex.schema.createTable('selling_point', table => {
      table.increments('id')
      table.integer('job_id').unsigned().notNullable().references('job.id')
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('category'))) {
    await knex.schema.createTable('category', table => {
      table.increments('id')
      table.text('slug').notNullable().unique()
      table.text('name').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('job_category'))) {
    await knex.schema.createTable('job_category', table => {
      table.increments('id')
      table.integer('job_id').unsigned().notNullable().references('job.id')
      table.integer('category_id').unsigned().notNullable().references('category.id')
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('job_type'))) {
    await knex.schema.createTable('job_type', table => {
      table.increments('id')
      table.text('slug').notNullable().unique()
      table.text('name').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('job_type_job'))) {
    await knex.schema.createTable('job_type_job', table => {
      table.increments('id')
      table.integer('job_id').unsigned().notNullable().references('job.id')
      table.integer('job_type_id').unsigned().notNullable().references('job_type.id')
      table.timestamps(false, true)
    })
  }
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('job_type_job')
  await knex.schema.dropTableIfExists('job_type')
  await knex.schema.dropTableIfExists('job_category')
  await knex.schema.dropTableIfExists('category')
  await knex.schema.dropTableIfExists('selling_point')
  await knex.schema.dropTableIfExists('job')
  await knex.schema.dropTableIfExists('location')
  await knex.schema.dropTableIfExists('company')
  await knex.schema.dropTableIfExists('ad_type')
}
