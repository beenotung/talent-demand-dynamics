import { Page, chromium } from 'playwright'
import { proxy } from './proxy'
import { find, toSqliteTimestamp } from 'better-sqlite3-proxy'
import { db } from './db'
import { readFileSync, writeFileSync } from 'fs'
import { format_time_duration } from '@beenotung/tslib/format'
import { later } from '@beenotung/tslib/async/wait'

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

  let nNewJob = 0

  for (let job of jobs) {
    let status = storeJob(job)
    if (status == NEW) {
      jobDetailCollector.queueJob(job.jobId)
      nNewJob++
    }
  }

  return { nNewJob }
}

type CollectedJobDetail = Awaited<ReturnType<typeof collectJobDetail>>

async function collectJobDetail(page: Page, jobId: number) {
  let job = proxy.job[jobId]
  let url = `https://hk.jobsdb.com/hk/en/job/${job.slug}-${job.id}`

  async function run() {
    await page.goto(url)
    return await page.evaluate(() => {
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

      let additionalInformation: Partial<{
        'Career Level': string
        'Qualification': string
        'Years of Experience': string
        'Company Website': string
      }> = {}
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
                  JSON.stringify({ key, value }),
              )
          }
        }
      }

      function nullCast<T>(): T | null {
        return null
      }

      let companyOverview: { html: string; text: string } | null = nullCast()
      function findCompanyOverview(h4: HTMLHeadingElement) {
        let div = h4.parentElement?.nextElementSibling
        if (!(div instanceof HTMLDivElement))
          throw new Error('companyOverview not found')
        companyOverview = { html: div.innerHTML, text: div.innerText }
      }

      let additionalCompanyInformation: Partial<{
        'Industry': string
        'Benefits & Others': string
      }> = {}
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
                  JSON.stringify({ key, value }),
              )
          }
        }
      }

      findSections()

      return {
        jobDescription,
        additionalInformation,
        companyOverview,
        additionalCompanyInformation,
      }
    })
  }

  let jobDetail = await run().catch(async e => {
    console.log()
    console.error('Failed to get job detail, jobId:', jobId, 'url:', url)
    console.error(e)
    console.log()
    await later(2000 + Math.random() * 1000)
    return run()
  })

  return { jobId, url, ...jobDetail }
}

let storeCollectedJobDetail = db.transaction(
  (jobDetail: CollectedJobDetail) => {
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

    let company_overview_id = !companyOverview
      ? null
      : proxy.content.push({
          html: companyOverview.html,
          text: companyOverview.text,
        })

    let company_industry_id = !additionalCompanyInformation.Industry
      ? null
      : getDataId(proxy.company_industry, {
          company_industry: additionalCompanyInformation.Industry,
        })

    let benefits_and_others =
      additionalCompanyInformation['Benefits & Others']?.trim() || null

    proxy.job_detail[jobId] = {
      description_id,
      career_level_id,
      qualification_id,
      years_of_experience_id,
      company_website_id,
      company_overview_id,
      company_industry_id,
      benefits_and_others,
      has_count_word: false,
    }

    if (benefits_and_others) {
      for (let benefit of benefits_and_others.split(',')) {
        benefit = benefit.trim()
        if (!benefit) continue
        let benefit_id = getDataId(proxy.benefit, { benefit })
        getDataId(proxy.company_benefit, {
          job_detail_id: jobId,
          benefit_id,
        })
      }
    }
  },
)

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
    progress.jobs = jobIdQueue.length
    reportProgress()
    let jobId = jobIdQueue.shift()
    if (!jobId) {
      status = 'idle'
      for (let teardown of teardownList) {
        teardown()
      }
      return
    }
    status = 'running'
    let startTime = Date.now()
    collectJobDetail(page, jobId)
      .then(storeCollectedJobDetail)
      .finally(() => {
        let endTime = Date.now()
        progress.jobsUsedTime += endTime - startTime
        progress.jobsDone++
        loop()
      })
  }

  type Teardown = () => void

  let teardownList: Teardown[] = []

  function onEnd(teardown: Teardown) {
    if (status == 'idle') {
      teardown()
    } else {
      teardownList.push(teardown)
    }
  }

  loop()

  return {
    queueJob,
    onEnd,
  }
}

type JobDetailCollector = ReturnType<typeof createJobDetailCollector>

let progress = {
  startTime: Date.now(),
  page: 0,
  pages: 0,
  jobs: 0,
  jobsDone: 0,
  jobsUsedTime: 0,
  oldPage: 0,
  maxOldPage: 20,
}
let lastReportLine = ''
function reportProgress() {
  let passedTime = Date.now() - progress.startTime
  let uptime = format_time_duration(passedTime)
  let jobsETA = format_time_duration(
    (progress.jobsUsedTime / progress.jobsDone) * progress.jobs,
  )
  let reportLine = `  pages: ${progress.page}/${progress.pages}`
  reportLine += ` | old pages: ${progress.oldPage}/${progress.maxOldPage}`
  reportLine += ` | pending jobs: ${progress.jobs} (ETA: ${jobsETA})`
  reportLine += ` | passed time: ${uptime}`
  process.stdout.write(
    '\r' +
      reportLine +
      ' '.repeat(Math.max(0, lastReportLine.length - reportLine.length)),
  )
  lastReportLine = reportLine
}

async function main() {
  let browser = await chromium.launch({ headless: true })
  let page = await browser.newPage()
  let url = 'https://hk.jobsdb.com/hk/jobs/information-technology/1'
  await page.goto(url)

  let jobDetailCollector = createJobDetailCollector(await browser.newPage())

  progress.pages = await page.evaluate(() => {
    let select = document.querySelector<HTMLSelectElement>('select#pagination')
    if (!select) throw new Error('pagination not found')
    let pages = Math.max(
      ...Array.from(select.options, option => +option.value).filter(s => s),
    )
    if (!pages) throw new Error('Unknown pagination')
    return pages
  })

  for (
    progress.page = getCurrentPage();
    progress.page <= progress.pages && progress.oldPage <= progress.maxOldPage;
    progress.page++
  ) {
    reportProgress()
    let result = await collectJobList(page, progress.page, jobDetailCollector)
    if (result.nNewJob == 0) {
      progress.oldPage++
    } else {
      progress.oldPage = 0
    }
    saveCurrentPage(progress.page)
  }
  reportProgress()

  await page.close()
  jobDetailCollector.onEnd(async () => {
    await browser.close()
    console.log()
    console.log('ended.')
  })
}
main().catch(e => console.error(e))
