import { Page, chromium } from 'playwright'
import { proxy } from './proxy'
import { del, find, toSqliteTimestamp } from 'better-sqlite3-proxy'
import { db } from './db'
import { readFileSync, writeFileSync } from 'fs'
import { format_time_duration } from '@beenotung/tslib/format'
import { later } from '@beenotung/tslib/async/wait'
import { resolvePostTime } from './time'
import { GracefulPage } from 'graceful-playwright'

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
  page: GracefulPage,
  pageNo: number,
  jobDetailCollector: JobDetailCollector,
) {
  let url = `https://hk.jobsdb.com/jobs-in-information-communication-technology?page=${pageNo}&sortmode=ListedDate`
  await page.goto(url)
  let jobs = await page.evaluate(() => {
    for (let h3 of document.querySelectorAll('h3')) {
      if (h3.innerText == 'No matching search results') {
        return []
      }
    }
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
          // e.g. "73196713"
          let match = jobId.match(/^(\d+)$/)
          if (!match) throw new Error(`Invalid jobId: ` + jobId)
          let id = +match[1]
          return id
        }
        let jobId = findJobId()

        function findJobTitle() {
          let a = node.querySelector<HTMLAnchorElement>('h3 a')
          if (!a) throw new Error(`jobTitle not found`)
          let { pathname } = new URL(a.href)
          // e.g. /job/73196713
          let match = pathname.match(/^\/job\/(\d+)$/)
          if (!match) throw new Error('Unknown jobUrl: ' + pathname)
          let id = +match[1]
          if (id != jobId) throw new Error(`jobId mismatch: ${jobId} vs ${id}`)
          let jobTitle = a.innerText.trim()
          if (!jobTitle) throw new Error(`Unknown jobTitle, jobId: ` + id)
          return { jobTitle }
        }
        let { jobTitle } = findJobTitle()

        function findJobCardCompanyLink() {
          let a = node.querySelector<HTMLAnchorElement>(
            'a[data-automation="jobCompany"]',
          )
          if (!a) {
            for (let span of node.querySelectorAll('span')) {
              if (span.innerText == 'Private Advertiser') {
                return null
              }
            }
            throw new Error('jobCompany not found, jobId: ' + jobId)
          }
          let href = a.getAttribute('href')
          if (!href) throw new Error('jobCompany link not found')

          let id: number | null = null
          let slug: string | null = null

          // e.g. "/jobs?advertiserid=60189680"
          let match = href.match(/^\/jobs\?advertiserid=(\d+)$/)
          if (match) {
            id = +match[1] || null
          }

          // e.g. "/jobs?keywords=RTX+A%2FS"
          let search = href.split('?').slice(1).join('?')
          if (search) {
            slug = new URLSearchParams(search).get('keywords') || null
          }

          // e.g. "/Here-We-Seoul-jobs"
          match = slug ? null : href.match(/^\/([\w-'%&().,+~*!]+)-jobs$/)
          if (match) {
            slug = match[1]
            if (slug.includes('%')) {
              slug = decodeURI(slug)
            }
          }

          if (!slug && id) {
            slug = id.toString()
          }

          if (!slug) throw new Error('Unknown jobCompany : ' + href)

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
          let timeNode = node.querySelector(
            '[data-automation="jobListingDate"]',
          )
          if (!timeNode) throw new Error('jobPostTime not found')
          let relativeTime = timeNode.textContent?.trim()
          if (!relativeTime) throw new Error('Unknown jobPostTime')
          return `${relativeTime} @${Date.now()}`
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

  const STATUS_SKIP = 1
  const STATUS_NEW = 2

  let storeJob = db.transaction((job: Job) => {
    if (
      job.jobId in proxy.job &&
      (!job.company || proxy.job[job.jobId]?.company_id)
    ) {
      return STATUS_SKIP
    }

    let ad_type_id = getDataId(proxy.ad_type, { type: job.jobAdType })

    if (job.company) {
      job.company.id =
        find(proxy.company, {
          slug: job.company.slug,
          name: job.company.name,
        })?.id ||
        proxy.company.push({
          slug: job.company.slug,
          name: job.company.name,
          employees: null,
          profile_id: null,
        })
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
      slug: null,
      title: job.jobTitle,
      company_id: job.company?.id || null,
      location_id,
      post_time: job.jobPostTime,
      resolved_post_time: resolvePostTime(job.jobPostTime),
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

    return STATUS_NEW
  })

  progress.nJobsInPage = jobs.length
  progress.nNewJobsInPage = 0

  for (let job of jobs) {
    let status = storeJob(job)
    if (status == STATUS_NEW) {
      jobDetailCollector.queueJob(job.jobId)
      progress.nNewJobsInPage++
    }
  }
}

type CollectedJobDetail = Awaited<ReturnType<typeof collectJobDetail>>

async function collectJobDetail(page: Page, jobId: number) {
  let job = proxy.job[jobId]
  let url = `https://hk.jobsdb.com/job/${job.id}`

  async function run() {
    await page.goto(url)
    return await page.evaluate(() => {
      for (let h2 of document.querySelectorAll('h2')) {
        if (h2.innerText == 'This job is no longer advertised') {
          return null
        }
      }

      for (let h3 of document.querySelectorAll('h3')) {
        if (h3.innerText == 'We couldn’t find that page') {
          return null
        }
      }

      function findJobDescription() {
        let node = document.querySelector<HTMLDivElement>(
          '[data-automation="jobAdDetails"]',
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
            case 'Featured jobs':
              // not stored
              break
            default: {
              let profile = h4.closest<HTMLDivElement>(
                '[data-automation="company-profile"]',
              )
              if (profile) {
                findCompanyProfile(profile)
                break
              }
              throw new Error(
                'Unknown h4, text: ' +
                  JSON.stringify(text) +
                  ', url: ' +
                  location.href,
              )
            }
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

      let companyProfile: {
        html: string
        text: string
        employees?: string
      } | null = nullCast()
      function findCompanyProfile(profile: HTMLElement) {
        // e.g. `<span>101-1,000 employees</span>`
        // TODO collect number of employees
        companyProfile = {
          html: profile.outerHTML,
          text: profile.outerText,
        }
        let spans = profile.querySelectorAll('span')
        for (let span of spans) {
          let text = span.innerText
          if (text.endsWith(' employees')) {
            let employees = text.replace(/ employees$/, '')
            companyProfile.employees = employees
            break
          }
        }
      }

      findSections()

      return {
        jobDescription,
        additionalInformation,
        companyOverview,
        additionalCompanyInformation,
        companyProfile,
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

  return { jobId, url, jobDetail }
}

let storeCollectedJobDetail = db.transaction(
  (collectedJobDetail: CollectedJobDetail) => {
    let { jobId, url, jobDetail } = collectedJobDetail
    if (!jobDetail) {
      deleteJob(jobId)
      return null
    }
    let {
      jobDescription,
      additionalInformation,
      companyOverview,
      additionalCompanyInformation,
      companyProfile,
    } = jobDetail

    let company = proxy.job[jobId].company
    if (companyProfile && company) {
      let profile = company.profile
      if (profile) {
        if (profile.html != companyProfile.html) {
          profile.html = companyProfile.html
        }
        if (profile.text != companyProfile.text) {
          profile.text = companyProfile.text
        }
      } else {
        company.profile_id = proxy.content.push({
          html: companyProfile.html,
          text: companyProfile.text,
        })
      }
      if (
        companyProfile.employees &&
        company.employees != companyProfile.employees
      ) {
        company.employees = companyProfile.employees
      }
    }

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

function deleteJob(jobId: number) {
  del(proxy.selling_point, { job_id: jobId })
  del(proxy.job_category, { job_id: jobId })
  del(proxy.job_type_job, { job_id: jobId })
  delete proxy.job[jobId]
}

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
  pages: 177,
  nJobsInPage: 0,
  nNewJobsInPage: 0,
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
  let browser = await chromium.launch({ headless: false })
  let page = new GracefulPage({ from: browser })

  let jobDetailCollector = createJobDetailCollector(await browser.newPage())

  for (
    progress.page = getCurrentPage();
    progress.oldPage <= progress.maxOldPage;
    progress.page++
  ) {
    reportProgress()
    await collectJobList(page, progress.page, jobDetailCollector)
    if (progress.nNewJobsInPage == 0) {
      progress.oldPage++
    } else {
      progress.oldPage = 0
    }
    saveCurrentPage(progress.page)
    if (progress.nJobsInPage == 0) {
      progress.pages = progress.page
      break
    }
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
