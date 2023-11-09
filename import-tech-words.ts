import { find } from 'better-sqlite3-proxy'
import { proxy } from './proxy'
import { javascriptWebFrameworks } from './res/tech-words/javascript-web-frameworks'
import { mobileFrameworks } from './res/tech-words/mobile-frameworks'
import { patchTechs } from './res/tech-words/patch-techs'
import { programmingLanguages } from './res/tech-words/programming-languages'
import { serverFrameworks } from './res/tech-words/server-frameworks'
import { databases } from './res/tech-words/databases'

function importList(words: string[]) {
  for (let word of words) {
    word = word.toLowerCase()
    importWord(word)
    if (word.endsWith('.js')) {
      importWord(word.replace(/\.js$/, ''))
    }
    if (word.endsWith(' js')) {
      importWord(word.replace(/\ js$/, ''))
      importWord(word.replace(/\ js$/, '.js'))
    }
  }
}

function importWord(word: string) {
  let row = find(proxy.word, { word })
  if (!row) {
    proxy.word.push({
      word,
      is_tech: true,
      job_count: 0,
      company_count: 0,
    })
    return
  }
  if (row.is_tech) return
  row.is_tech = true
}

importList(programmingLanguages)
importList(serverFrameworks)
importList(javascriptWebFrameworks)
importList(mobileFrameworks)
importList(databases)
importList(patchTechs)
