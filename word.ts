export function tokenizeWord(word: string): string {
  word = word.replace(/ /g, '').replace(/\./g, '').replace(/-/g, '')
  switch (word) {
    case 's':
    case 'e':
      return ''
  }
  if (word == 'reactjs') return 'react'
  if (word == 'nuxt') return 'nuxtjs'
  if (word == 'node') return 'nodejs'
  if (word == 'nest') return 'nestjs'
  return word
}

export function splitWords(words: Set<string>, text: string): void {
  if (text.includes('r&d')) {
    words.add('r&d')
    text = text.replaceAll('r&d', '')
  }
  if (text.includes('r & d')) {
    words.add('r&d')
    text = text.replaceAll('r & d', '')
  }

  if (text.includes('j query')) {
    words.add('jquery')
    text = text.replaceAll('j query', '')
  }

  let match = text.match(/([\w-#]+)/g)
  if (!match) return
  for (let word of match) {
  }
}
