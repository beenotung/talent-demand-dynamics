import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type AdType = {
  id?: null | number
  type: string
}

export type Company = {
  id?: null | number
  slug: string
  name: string
}

export type Location = {
  id?: null | number
  slug: string
  name: string
}

export type Job = {
  id?: null | number
  ad_type_id: number
  ad_type?: AdType
  slug: string
  title: string
  company_id: null | number
  company?: Company
  location_id: null | number
  location?: Location
  post_time: string
}

export type SellingPoint = {
  id?: null | number
  job_id: number
  job?: Job
  content: string
}

export type Category = {
  id?: null | number
  slug: string
  name: string
}

export type JobCategory = {
  id?: null | number
  job_id: number
  job?: Job
  category_id: number
  category?: Category
}

export type JobType = {
  id?: null | number
  slug: string
  name: string
}

export type JobTypeJob = {
  id?: null | number
  job_id: number
  job?: Job
  job_type_id: number
  job_type?: JobType
}

export type CareerLevel = {
  id?: null | number
  career_level: string
}

export type Qualification = {
  id?: null | number
  qualification: string
}

export type YearsOfExperience = {
  id?: null | number
  years_of_experience: string
}

export type JobDetail = {
  id?: null | number
  job?: Job
  career_level_id: null | number
  career_level?: CareerLevel
  qualification_id: null | number
  qualification?: Qualification
  years_of_experience_id: null | number
  years_of_experience?: YearsOfExperience
}

export type DBProxy = {
  ad_type: AdType[]
  company: Company[]
  location: Location[]
  job: Job[]
  selling_point: SellingPoint[]
  category: Category[]
  job_category: JobCategory[]
  job_type: JobType[]
  job_type_job: JobTypeJob[]
  career_level: CareerLevel[]
  qualification: Qualification[]
  years_of_experience: YearsOfExperience[]
  job_detail: JobDetail[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    ad_type: [],
    company: [],
    location: [],
    job: [
      /* foreign references */
      ['ad_type', { field: 'ad_type_id', table: 'ad_type' }],
      ['company', { field: 'company_id', table: 'company' }],
      ['location', { field: 'location_id', table: 'location' }],
    ],
    selling_point: [
      /* foreign references */
      ['job', { field: 'job_id', table: 'job' }],
    ],
    category: [],
    job_category: [
      /* foreign references */
      ['job', { field: 'job_id', table: 'job' }],
      ['category', { field: 'category_id', table: 'category' }],
    ],
    job_type: [],
    job_type_job: [
      /* foreign references */
      ['job', { field: 'job_id', table: 'job' }],
      ['job_type', { field: 'job_type_id', table: 'job_type' }],
    ],
    career_level: [],
    qualification: [],
    years_of_experience: [],
    job_detail: [
      /* foreign references */
      ['job', { field: 'id', table: 'job' }],
      ['career_level', { field: 'career_level_id', table: 'career_level' }],
      ['qualification', { field: 'qualification_id', table: 'qualification' }],
      ['years_of_experience', { field: 'years_of_experience_id', table: 'years_of_experience' }],
    ],
  },
})
