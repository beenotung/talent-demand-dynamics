export function tokenizeWord(word: string): string {
  return word.replace(/ /g, '').replace(/\./g, '').replace(/-/g, '')
}
