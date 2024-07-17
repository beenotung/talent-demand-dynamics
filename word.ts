import { isStopWord } from 'meta-stopwords'

export function tokenizeWord(word: string): string {
  word = word.replace(/ /g, '').replace(/-/g, '')
  if (word[0] !== '.') {
    word = word.replaceAll('.', '')
  }
  if (word == 'reactjs') return 'react'
  if (word == 'nuxt') return 'nuxtjs'
  if (word == 'node') return 'nodejs'
  if (word == 'nest') return 'nestjs'
  return word
}

function expandPattern(word: string): string[] {
  if (word.startsWith('angular')) return [word]
  return [
    word,
    word + '.js',
    word + 'js',
    word.replace(/\.js$/, ''),
    word.replace(/js$/, ''),
  ]
}

export function* splitWords(
  specialWords: string[],
  allTechWords: string[],
  text: string,
) {
  if (text.includes('r&d')) {
    text = text.replaceAll('r&d', '')
    yield 'r&d'
  }
  if (text.includes('r & d')) {
    text = text.replaceAll('r & d', '')
    yield 'r&d'
  }

  if (text.includes('j query')) {
    text = text.replaceAll('j query', '')
    yield 'jquery'
  }
  if (text.includes('java script')) {
    text = text.replaceAll('java script', '')
    yield 'java script'
  }

  for (let word of specialWords) {
    let patterns = [
      ...expandPattern(word),
      ...expandPattern(tokenizeWord(word)),
    ]
    for (let pattern of patterns) {
      if (text.includes(pattern)) {
        text = text.replaceAll(pattern, '')
        yield word
      }
    }
  }

  let match = text.match(/([\w-#]+)/g)
  if (!match) return
  match.sort((a, b) => b.length - a.length)
  for (let word of match) {
    if (+word) continue
    if (!allTechWords.includes(word) && isStopWord(word)) continue
    // text = singular(text) // skip this transform to preserve the "s" in "js"
    yield word
  }
}
