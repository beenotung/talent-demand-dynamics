import { Page, chromium } from 'playwright'
import { Job, proxy } from './proxy'
import { find, toSqliteTimestamp } from 'better-sqlite3-proxy'
import { db } from './db'
import { readFileSync, writeFileSync } from 'fs'
import { createDefer } from '@beenotung/tslib/async/defer'
import { later, runLater } from '@beenotung/tslib/async/wait'

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

  const SKIP = 1
  const NEW = 2

  let storeJob = db.transaction((job: (typeof jobs)[number]) => {
    if (job.jobId in proxy.job) {
      return SKIP
    }

    let ad_type_id =
      find(proxy.ad_type, { type: job.jobAdType })?.id ||
      proxy.ad_type.push({ type: job.jobAdType })

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

  for (let job of jobs) {
    let status = storeJob(job)
    if (status == NEW) {
      jobDetailCollector.queueJob(job.jobId)
    }
  }
}

async function collectJobDetail(page: Page, jobId: number) {
  let job = proxy.job[jobId]
  let url = `https://hk.jobsdb.com/hk/en/job/${job.slug}-${job.id}`
  await page.goto(url)
  await page.evaluate(() => {
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
      document.querySelectorAll('h4')
    }
  })
}

function createJobDetailCollector(page: Page) {
  let jobIdQueue: number[] = []
  let queue = Promise.resolve()
  async function wait() {
    while (jobIdQueue.length > 0) {
      await queue
    }
    await page.close()
  }
  function queueJob(jobId: number) {
    jobIdQueue.push(jobId)
    queue = queue.then(tick)
  }
  async function tick() {
    let jobId = jobIdQueue.shift()
    if (!jobId) return
    await collectJobDetail(page, jobId)
    queue = queue.then(tick)
  }
  return {
    queueJob,
    wait,
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
    if (!pages) throw new Error('unknown pagination')
    return pages
  })

  for (let pageNo = getCurrentPage(); pageNo <= pages; pageNo++) {
    console.log(`${pageNo}/${pages}`)
    await collectJobList(page, pageNo, jobDetailCollector)
    saveCurrentPage(pageNo)
  }

  await page.close()
  await jobDetailCollector.wait()
  await browser.close()
}
main().catch(e => console.error(e))
