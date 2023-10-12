import { Page, chromium } from 'playwright'
import { proxy } from './proxy'
import { find, toSqliteTimestamp } from 'better-sqlite3-proxy'
import { db } from './db'
import { readFileSync, writeFileSync } from 'fs'

function getCurrentPage() {
  try {
    return +readFileSync('last.txt').toString() || 1
  } catch (error) {
    return 1
  }
}
function saveCurrentPage(page: number) {
  writeFileSync('last.txt', page + '')
}

async function collectJobList(
  page: Page,
  pageNo: number,
  jobDetailCollector: JobDetailCollector,
) {
  let url = 'https://hk.jobsdb.com/hk/jobs/information-technology/' + pageNo
  await page.goto(url)
  let jobs = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll<HTMLDivElement>('[data-search-sol-meta]'),
      node => {
        console.log(node)
        let searchSolMeta = JSON.parse(node.dataset.searchSolMeta!)
        let {
          // e.g. ORGANIC
          jobAdType,
        } = searchSolMeta

        if (!jobAdType) throw new Error('jobAdType not found')

        function findJobId() {
          let { jobId } = searchSolMeta
          // e.g. jobsdb-hk-job-100003010667017
          let match = jobId.match(/^jobsdb-hk-job-(\d+)$/)
          if (!match) throw new Error(`Invalid jobId: ` + jobId)
          let id = +match[1]
          return id
        }
        let jobId = findJobId()

        function findJobTitle() {
          let a = node.querySelector('a')
          if (!a) throw new Error(`jobTitle not found`)
          let { pathname } = new URL(a.href)
          // e.g. /hk/en/job/assistant-officer-information-technology-100003010667017
          let match = pathname.match(
            /^\/hk\/en\/job\/([\w-'%&().,+~*!]+)-(\d+)$/,
          )
          if (!match) throw new Error('Unknown jobTitle: ' + pathname)
          let jobSlug = match[1]
          let id = +match[2]
          let jobTitle = a.innerText.trim()
          if (id != jobId) throw new Error(`jobId mismatch: ${jobId} vs ${id}`)
          return { jobSlug, jobTitle }
        }
        let { jobSlug, jobTitle } = findJobTitle()

        function findJobCardCompanyLink() {
          let a = node.querySelector<HTMLAnchorElement>(
            'a[data-automation=jobCardCompanyLink][href*=jobs-at]',
          )
          if (!a) return
          let { pathname } = new URL(a.href)
          // e.g. /hk/jobs-at/yan-chai-hospital-board-hk100027455/1
          let match = pathname.match(
            /^\/hk\/jobs-at\/([\w-'%&().,+~*!]+)-hk(\d+)\/(\d+)$/,
          )
          if (!match)
            throw new Error('Unknown jobCardCompanyLink : ' + pathname)
          let slug = match[1]
          let id = +match[2]
          let name = a.innerText.trim()
          return { id, slug, name }
        }
        let company = findJobCardCompanyLink()

        function findJobCardLocationLink() {
          let a = node.querySelector<HTMLAnchorElement>(
            'a[data-automation=jobCardLocationLink][href*=-jobs-in-]',
          )
          if (!a) return
          let { pathname } = new URL(a.href)
          // e.g. /hk/information-technology-jobs-in-tsuen-wan-area/1
          let match = pathname.match(
            /^\/hk\/information-technology-jobs-in-([a-z-]+)\/(\d+)$/,
          )
          if (!match)
            throw new Error('Unknown jobCardLocationLink: ' + pathname)
          let slug = match[1]
          let name = a.innerText.trim()
          if (slug.endsWith('-area')) {
            slug = slug.replace('-area', '')
          }
          if (name.endsWith(' Area')) {
            name = name.replace(' Area', '')
          }
          return { slug, name }
        }
        let jobLocation = findJobCardLocationLink()

        function findJobCardSellingPoints() {
          return Array.from(
            node.querySelectorAll<HTMLLIElement>(
              '[data-automation="job-card-selling-points"] ul li',
            ),
            li => li.innerText.trim(),
          )
        }
        let jobSellingPoints = findJobCardSellingPoints()

        function findJobPostTime() {
          let timeNode = node.querySelector('time[datetime]')
          if (!timeNode) throw new Error('jobPostTime not found')
          let value = timeNode.getAttribute('datetime')!
          let date = new Date(value)
          let time = date.getTime()
          if (!time) throw new Error('invalid jobPostTime: ' + value)
          return time
        }
        let jobPostTime = findJobPostTime()

        let jobCategories = Array.from(
          node.querySelectorAll<HTMLAnchorElement>(
            'a[data-automation=jobCardCategoryLink][href*=job-list]',
          ),
          a => {
            let { pathname } = new URL(a.href)

            // e.g. /hk/job-list/information-technology/network-system/1
            let match = pathname.match(
              /^\/hk\/job-list\/([a-z-]+)\/([a-z-]+)\/(\d+)$/,
            )
            if (!match)
              throw new Error('Unknown jobCardCategoryLink: ' + pathname)
            let industry = match[1]
            if (industry != 'information-technology') return
            let slug = match[2]
            let name = a.innerText.trim()
            return { slug, name }
          },
        )

        function findJobCardJobTypeLinks() {
          return Array.from(
            node.querySelectorAll<HTMLAnchorElement>(
              'a[data-automation=jobCardJobTypeLink]',
            ),
            a => {
              let { pathname } = new URL(a.href)
              // .e.g /hk/jobs/information-technology/full-time-employment/1
              let match = pathname.match(
                /^\/hk\/jobs\/information-technology\/([a-z-]+)\/(\d+)$/,
              )
              if (!match)
                throw new Error(`Unknown jobCardJobTypeLink: ` + pathname)
              let slug = match[1]
              let name = a.innerText.trim()
              return { slug, name }
            },
          )
        }
        let jobTypes = findJobCardJobTypeLinks()

        return {
          jobId,
          jobAdType,
          jobSlug,
          jobTitle,
          company,
          jobLocation,
          jobSellingPoints,
          jobPostTime,
          jobCategories,
          jobTypes,
        }
      },
    )
  })

  type Job = (typeof jobs)[number]

  const SKIP = 1
  const NEW = 2

  let storeJob = db.transaction((job: Job) => {
    if (job.jobId in proxy.job) {
      return SKIP
    }

    let ad_type_id = getDataId(proxy.ad_type, { type: job.jobAdType })

    if (job.company && !(job.company.id in proxy.company)) {
      proxy.company[job.company.id] = {
        slug: job.company.slug,
        name: job.company.name,
        overview_id: null,
        industry: null,
        benefits: null,
      }
    }

    let location_id = !job.jobLocation
      ? null
      : find(proxy.location, { slug: job.jobLocation.slug })?.id ||
        proxy.location.push({
          slug: job.jobLocation.slug,
          name: job.jobLocation.name,
        })

    proxy.job[job.jobId] = {
      ad_type_id,
      slug: job.jobSlug,
      title: job.jobTitle,
      company_id: job.company?.id || null,
      location_id,
      post_time: toSqliteTimestamp(new Date(job.jobPostTime)),
    }

    for (let content of job.jobSellingPoints) {
      proxy.selling_point.push({
        job_id: job.jobId,
        content,
      })
    }

    for (let category of job.jobCategories) {
      if (!category) continue
      let category_id =
        find(proxy.category, { slug: category.slug })?.id ||
        proxy.category.push({ slug: category.slug, name: category.name })
      proxy.job_category.push({ job_id: job.jobId, category_id })
    }

    for (let jobType of job.jobTypes) {
      let job_type_id =
        find(proxy.job_type, { slug: jobType.slug })?.id ||
        proxy.job_type.push({ slug: jobType.slug, name: jobType.name })
      proxy.job_type_job.push({ job_id: job.jobId, job_type_id })
    }

    return NEW
  })

  for (let job of jobs) {
    let status = storeJob(job)
    if (status == NEW) {
      jobDetailCollector.queueJob(job.jobId)
    }
  }
}

type JobDetail = {
  jobId: number
  url: string
  jobDescription: {
    html: string
    text: string
  }
  additionalInformation: Partial<{
    'Career Level': string
    'Qualification': string
    'Years of Experience': string
    'Company Website': string
  }>
  companyOverview: null | { html: string; text: string }
  additionalCompanyInformation: Partial<{
    'Industry': string
    'Benefits & Others': string
  }>
}

async function collectJobDetail(page: Page, jobId: number) {
  let job = proxy.job[jobId]
  let url = `https://hk.jobsdb.com/hk/en/job/${job.slug}-${job.id}`
  await page.goto(url)
  let jobDetail = await page.evaluate(
    ({ jobId, url }) => {
      function findJobDescription() {
        let node = document.querySelector<HTMLDivElement>(
          '[data-automation="jobDescription"]',
        )
        if (!node) throw new Error('jobDescription not found')
        let html = node.innerHTML.trim()
        let text = node.innerText.trim()
        return { html, text }
      }
      let jobDescription = findJobDescription()

      function findSections() {
        // [
        //   'Job Highlights',
        //   'Job Description',
        //   'Additional Information',
        //   'Company Overview',
        //   'Additional Company Information',
        // ]
        for (let h4 of document.querySelectorAll('h4')) {
          let text = h4.innerText
          switch (text) {
            case 'Job Highlights':
              // already collected from job list
              break
            case 'Job Description':
              // already collected using data-automation
              break
            case 'Additional Information':
              findAdditionalInformation(h4)
              break
            case 'Company Overview':
              findCompanyOverview(h4)
              break
            case 'Additional Company Information':
              findAdditionalCompanyInformation(h4)
              break
            default:
              throw new Error('Unknown h4, text: ' + JSON.stringify(text))
          }
        }
      }

      let additionalInformation: JobDetail['additionalInformation'] = {}
      function findAdditionalInformation(h4: HTMLHeadingElement) {
        let div = h4.parentElement?.nextElementSibling
        if (!(div instanceof HTMLDivElement))
          throw new Error('additionalInformation table not found')
        let lines = div.innerText.split('\n')
        for (let i = 0; i < lines.length; i += 2) {
          let key = lines[i]
          let value = lines[i + 1].trim()
          switch (key) {
            case 'Career Level':
            case 'Qualification':
            case 'Years of Experience':
            case 'Company Website':
              additionalInformation[key] = value
              break
            case 'Job Type':
            case 'Job Functions':
              // already collected from job list
              break
            default:
              throw new Error(
                'Unknown additionalInformation:' +
                  JSON.stringify({ key, value, url, jobId }),
              )
          }
        }
      }

      let companyOverview: { html: string; text: string } | null = null
      function findCompanyOverview(h4: HTMLHeadingElement) {
        let div = h4.parentElement?.nextElementSibling
        if (!(div instanceof HTMLDivElement))
          throw new Error('companyOverview not found')
        companyOverview = { html: div.innerHTML, text: div.innerText }
      }

      let additionalCompanyInformation: JobDetail['additionalCompanyInformation'] =
        {}
      function findAdditionalCompanyInformation(h4: HTMLHeadElement) {
        let div = h4.parentElement?.nextElementSibling
        if (!(div instanceof HTMLDivElement))
          throw new Error('additionalCompanyInformation not found')
        let lines = div.innerText.split('\n')
        for (let i = 0; i < lines.length; i += 2) {
          let key = lines[i]
          let value = lines[i + 1]
          switch (key) {
            case 'Industry':
            case 'Benefits & Others':
              additionalCompanyInformation[key] = value
              break
            default:
              throw new Error(
                'Unknown additionalCompanyInformation: ' +
                  JSON.stringify({ key, value, url, jobId }),
              )
          }
        }
      }

      findSections()

      return {
        jobId,
        url,
        jobDescription,
        additionalInformation,
        companyOverview,
        additionalCompanyInformation,
      }
    },
    { jobId, url },
  )

  let storeJobDetail = db.transaction((jobDetail: JobDetail) => {
    let {
      jobId,
      url,
      jobDescription,
      additionalInformation,
      companyOverview,
      additionalCompanyInformation,
    } = jobDetail

    if (jobId in proxy.job_detail) return

    let description_id = proxy.content.push({
      html: jobDescription.html,
      text: jobDescription.text,
    })

    let career_level_id = !additionalInformation['Career Level']
      ? null
      : getDataId(proxy.career_level, {
          career_level: additionalInformation['Career Level'],
        })

    let qualification_id = !additionalInformation.Qualification
      ? null
      : getDataId(proxy.qualification, {
          qualification: additionalInformation.Qualification,
        })

    let years_of_experience_id = !additionalInformation['Years of Experience']
      ? null
      : getDataId(proxy.years_of_experience, {
          years_of_experience: additionalInformation['Years of Experience'],
        })

    let company_website_id = !additionalInformation['Company Website']
      ? null
      : getDataId(proxy.company_website, {
          company_website: additionalInformation['Company Website'],
        })

    proxy.job_detail[jobId] = {
      description_id,
      career_level_id,
      qualification_id,
      years_of_experience_id,
      company_website_id,
    }

    let job = proxy.job[jobId]
    let company = job.company!
    if (companyOverview?.text) {
      let overview = company.overview
      if (overview) {
        overview.html = companyOverview.html
        overview.text = companyOverview.text
      } else {
        company.overview_id = proxy.content.push({
          html: companyOverview.html,
          text: companyOverview.text,
        })
      }
    }

    if (additionalCompanyInformation.Industry) {
      company.industry = additionalCompanyInformation.Industry
    }

    let benefits = additionalCompanyInformation['Benefits & Others']
    if (benefits) {
      company.benefits = benefits
      for (let benefit of benefits.split(',')) {
        benefit = benefit.trim()
        if (!benefit) continue
        let benefit_id = getDataId(proxy.benefit, { benefit })
        getDataId(proxy.company_benefit, {
          company_id: company.id!,
          benefit_id,
        })
      }
    }
  })

  storeJobDetail(jobDetail)
}

function getDataId<T extends { id?: number | null }>(
  table: T[],
  data: T,
): number {
  return find(table, data)?.id || table.push(data)
}

let select_pending_jobs = db
  .prepare(
    /* sql */ `
select
  id
from job
where id not in (
  select id from job_detail
)
`,
  )
  .pluck()

function createJobDetailCollector(page: Page) {
  type Status = 'running' | 'idle'
  let jobIdQueue: number[] = select_pending_jobs.all() as number[]
  let status: Status = 'idle'

  function queueJob(jobId: number) {
    jobIdQueue.push(jobId)
    if (status == 'idle') {
      loop()
    }
  }

  function loop() {
    let jobId = jobIdQueue.shift()
    if (!jobId) {
      status = 'idle'
      for (let teardown of teardownList) {
        teardown()
      }
      return
    }
    status = 'running'
    collectJobDetail(page, jobId).finally(loop)
  }

  loop()

  type Teardown = () => void

  let teardownList: Teardown[] = []

  let onEnd = teardownList.push.bind(teardownList)

  return {
    queueJob,
    onEnd,
  }
}

type JobDetailCollector = ReturnType<typeof createJobDetailCollector>

async function main() {
  let browser = await chromium.launch({ headless: false })
  let page = await browser.newPage()
  let url = 'https://hk.jobsdb.com/hk/jobs/information-technology/1'
  await page.goto(url)

  let jobDetailCollector = createJobDetailCollector(await browser.newPage())

  let pages = await page.evaluate(() => {
    let select = document.querySelector<HTMLSelectElement>('select#pagination')
    if (!select) throw new Error('pagination not found')
    let pages = Math.max(
      ...Array.from(select.options, option => +option.value).filter(s => s),
    )
    if (!pages) throw new Error('Unknown pagination')
    return pages
  })

  for (let pageNo = getCurrentPage(); pageNo <= pages; pageNo++) {
    console.log(`${pageNo}/${pages}`)
    await collectJobList(page, pageNo, jobDetailCollector)
    saveCurrentPage(pageNo)
  }

  await page.close()
  jobDetailCollector.onEnd(() => {
    browser.close()
  })
}
main().catch(e => console.error(e))
