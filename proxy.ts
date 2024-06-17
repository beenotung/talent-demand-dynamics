import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type AdType = {
  id?: null | number
  type: string
}

export type Location = {
  id?: null | number
  slug: string
  name: string
}

export type Content = {
  id?: null | number
  html: string
  text: string
}

export type Benefit = {
  id?: null | number
  benefit: string
}

export type Company = {
  id?: null | number
  slug: string
  name: string
  employees: null | string
  profile_id: null | number
  profile?: Content
}

export type CareerLevel = {
  id?: null | number
  career_level: string
}

export type Job = {
  id?: null | number
  ad_type_id: number
  ad_type?: AdType
  slug: null | string
  title: string
  location_id: null | number
  location?: Location
  company_id: null | number
  company?: Company
  post_time: string
  resolved_post_time: null | string
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

export type Qualification = {
  id?: null | number
  qualification: string
}

export type Word = {
  id?: null | number
  word: string
  is_tech: null | boolean
  job_count: number
  company_count: number
}

export type SellingPoint = {
  id?: null | number
  job_id: number
  job?: Job
  content: string
}

export type CompanyIndustry = {
  id?: null | number
  company_industry: string
}

export type CompanyWord = {
  id?: null | number
  company_id: number
  company?: Company
  word_id: number
  word?: Word
}

export type YearsOfExperience = {
  id?: null | number
  years_of_experience: string
}

export type CompanyWebsite = {
  id?: null | number
  company_website: string
}

export type JobDetail = {
  id?: null | number
  job?: Job
  description_id: number
  description?: Content
  career_level_id: null | number
  career_level?: CareerLevel
  qualification_id: null | number
  qualification?: Qualification
  years_of_experience_id: null | number
  years_of_experience?: YearsOfExperience
  company_website_id: null | number
  company_website?: CompanyWebsite
  company_overview_id: null | number
  company_overview?: Content
  company_industry_id: null | number
  company_industry?: CompanyIndustry
  benefits_and_others: null | string
  has_count_word: null | boolean
}

export type CompanyBenefit = {
  id?: null | number
  benefit_id: number
  benefit?: Benefit
  job_detail_id: number
  job_detail?: JobDetail
}

export type UserAgent = {
  id?: null | number
  user_agent: string
}

export type Url = {
  id?: null | number
  url: string
}

export type RequestLog = {
  id?: null | number
  user_agent_id: null | number
  user_agent?: UserAgent
  url_id: number
  url?: Url
  timestamp: number
}

export type DBProxy = {
  ad_type: AdType[]
  location: Location[]
  content: Content[]
  benefit: Benefit[]
  company: Company[]
  career_level: CareerLevel[]
  job: Job[]
  category: Category[]
  job_category: JobCategory[]
  job_type: JobType[]
  job_type_job: JobTypeJob[]
  qualification: Qualification[]
  word: Word[]
  selling_point: SellingPoint[]
  company_industry: CompanyIndustry[]
  company_word: CompanyWord[]
  years_of_experience: YearsOfExperience[]
  company_website: CompanyWebsite[]
  job_detail: JobDetail[]
  company_benefit: CompanyBenefit[]
  user_agent: UserAgent[]
  url: Url[]
  request_log: RequestLog[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    ad_type: [],
    location: [],
    content: [],
    benefit: [],
    company: [
      /* foreign references */
      ['profile', { field: 'profile_id', table: 'content' }],
    ],
    career_level: [],
    job: [
      /* foreign references */
      ['ad_type', { field: 'ad_type_id', table: 'ad_type' }],
      ['location', { field: 'location_id', table: 'location' }],
      ['company', { field: 'company_id', table: 'company' }],
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
    qualification: [],
    word: [],
    selling_point: [
      /* foreign references */
      ['job', { field: 'job_id', table: 'job' }],
    ],
    company_industry: [],
    company_word: [
      /* foreign references */
      ['company', { field: 'company_id', table: 'company' }],
      ['word', { field: 'word_id', table: 'word' }],
    ],
    years_of_experience: [],
    company_website: [],
    job_detail: [
      /* foreign references */
      ['job', { field: 'id', table: 'job' }],
      ['description', { field: 'description_id', table: 'content' }],
      ['career_level', { field: 'career_level_id', table: 'career_level' }],
      ['qualification', { field: 'qualification_id', table: 'qualification' }],
      ['years_of_experience', { field: 'years_of_experience_id', table: 'years_of_experience' }],
      ['company_website', { field: 'company_website_id', table: 'company_website' }],
      ['company_overview', { field: 'company_overview_id', table: 'content' }],
      ['company_industry', { field: 'company_industry_id', table: 'company_industry' }],
    ],
    company_benefit: [
      /* foreign references */
      ['benefit', { field: 'benefit_id', table: 'benefit' }],
      ['job_detail', { field: 'job_detail_id', table: 'job_detail' }],
    ],
    user_agent: [],
    url: [],
    request_log: [
      /* foreign references */
      ['user_agent', { field: 'user_agent_id', table: 'user_agent' }],
      ['url', { field: 'url_id', table: 'url' }],
    ],
  },
})
