import { chromium } from 'playwright'

async function main() {
  let browser = await chromium.launch({ headless: false })
  let page = await browser.newPage()
  let url = 'https://hk.jobsdb.com/hk/jobs/information-technology/1'
  await page.goto(url)

  let result = await page.evaluate(() => {
    // TODO
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
          let match = pathname.match(/^\/hk\/en\/job\/([a-z-]+)-(\d+)$/)
          if (!match) throw new Error('jobTitle not found')
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
          if (!a) throw new Error(`jobCardCompanyLink not found`)
          let { pathname } = new URL(a.href)
          // e.g. /hk/jobs-at/yan-chai-hospital-board-hk100027455/1
          let match = pathname.match(
            /^\/hk\/jobs-at\/([a-z-]+)-hk(\d+)\/(\d+)$/,
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
          if (!a) throw new Error(`jobCardLocationLink not found`)
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

        let jobCategories = Array.from(
          node.querySelectorAll<HTMLAnchorElement>(
            'a[data-automation=jobCardCategoryLink][href*=job-list]',
          ),
          a => {
            let { pathname } = new URL(a.href)

            // e.g. /hk/job-list/information-technology/network-system/1
            let match = pathname.match(
              /^\/hk\/job-list\/information-technology\/([a-z-]+)\/(\d+)$/,
            )
            if (!match)
              throw new Error('Unknown jobCardCategoryLink: ' + pathname)
            let slug = match[1]
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
          jobCategories,
          jobTypes,
        }
      },
    )
  })
  console.log(result)
  throw new Error('TODO')

  await page.close()
  await browser.close()
}
main().catch(e => console.error(e))
