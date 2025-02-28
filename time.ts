import { DAY, HOUR, MINUTE, MONTH } from '@beenotung/tslib/time'
import { filter, toSqliteTimestamp } from 'better-sqlite3-proxy'
import { proxy } from './proxy'

/**
 * @param post time in the format of "9h ago @1706109568723"
 * @returns timestamp in sqlite format
 *  */
export function resolvePostTime(text: string): string {
  if (!text.includes('@')) {
    return text
  }
  {
    let match = text.match(/^just now @(\d+)$/i)
    if (match) {
      let time = +match[1]
      if (!time) throw new Error(`Failed to extract timestamp: ${text}`)
      return toSqliteTimestamp(new Date(time))
    }
  }
  let match = text.match(/^(\d+)(\w+)\+? ago @(\d+)$/)
  if (!match) throw new Error(`Invalid post time: ${text}`)
  let relativeAmount = +match[1]
  let relativeUnit = match[2]
  let time = +match[3]
  let date = new Date(time)
  switch (relativeUnit) {
    case 'm':
      date.setTime(date.getTime() - relativeAmount * MINUTE)
      break
    case 'h':
      date.setTime(date.getTime() - relativeAmount * HOUR)
      break
    case 'd':
      date.setTime(date.getTime() - relativeAmount * DAY)
      break
    case 'mo':
      date.setTime(date.getTime() - relativeAmount * MONTH)
      break
    default:
      throw new Error(`Invalid post time, unit: ${relativeUnit}`)
  }
  return toSqliteTimestamp(date)
}

export function patchPostTime() {
  let posts = filter(proxy.job, { resolved_post_time: null })
  for (let post of posts) {
    post.resolved_post_time = resolvePostTime(post.post_time)
  }
}
