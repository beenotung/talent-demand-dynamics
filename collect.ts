import { chromium } from 'playwright'
import { proxy } from './proxy'
import { find, toSqliteTimestamp } from 'better-sqlite3-proxy'
import { log } from 'console'
import { db } from './db'

async function main() {
  let browser = await chromium.launch({ headless: false })
  let page = await browser.newPage()
  let url = 'https://hk.jobsdb.com/hk/jobs/information-technology/1'
  await page.goto(url)

  let pages = await page.evaluate(() => {
    let select = document.querySelector<HTMLSelectElement>('select#pagination')
    if (!select) throw new Error('pagination not found')
    let pages = Math.max(
      ...Array.from(select.options, option => +option.value).filter(s => s),
    )
    if (!pages) throw new Error('unknown pagination')
    return pages
  })

  for (let pageNo = 1; pageNo <= pages; pageNo++) {
    console.log(`${pageNo}/${pages}`)
    let url = 'https://hk.jobsdb.com/hk/jobs/information-technology/' + pageNo
    await page.goto(url)
    let jobs = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll<HTMLDivElement>('[data-search-sol-meta]'),
        node => {
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
            let match = pathname.match(/^\/hk\/en\/job\/([\w-'%&().]+)-(\d+)$/)
            if (!match) throw new Error('Unknown jobTitle: ' + pathname)
            let jobSlug = match[1]
            let id = +match[2]
            let jobTitle = a.innerText.trim()
            if (id != jobId)
              throw new Error(`jobId mismatch: ${jobId} vs ${id}`)
            return { jobSlug, jobTitle }
          }
          let { jobSlug, jobTitle } = findJobTitle()

          function findJobCardCompanyLink() {
            let a = node.querySelector<HTMLAnchorElement>(
              'a[data-automation=jobCardCompanyLink][href*=jobs-at]',
            )
            if (!a) throw new Error(`jobCardCompanyLink not found`)
            let { pathname } = new URL(a.href)
            // e.g. /hk/jobs-at/yan-chai-hospital-board-hk100027455/1
            let match = pathname.match(
              /^\/hk\/jobs-at\/([\w-'%&().]+)-hk(\d+)\/(\d+)$/,
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

    let storeJob = db.transaction((job: (typeof jobs)[number]) => {
      if (job.jobId in proxy.job) {
        return
      }

      let ad_type_id =
        find(proxy.ad_type, { type: job.jobAdType })?.id ||
        proxy.ad_type.push({ type: job.jobAdType })

      if (!(job.company.id in proxy.company)) {
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
        company_id: job.company.id,
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
    })

    for (let job of jobs) {
      storeJob(job)
    }
  }

  // TODO scroll to next page
  throw new Error('TODO')

  await page.close()
  await browser.close()
}
main().catch(e => console.error(e))
