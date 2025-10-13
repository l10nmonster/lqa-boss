/**
 * Generate a nanoid-equivalent random ID
 * @param length Length of the ID (default: 21)
 * @param alphabet Custom alphabet to use (default: nanoid-like alphabet)
 * @returns Random ID string
 */
export function nanoidEquivalent(
  length = 21,
  alphabet = 'useandom-26T19834086PxcnbIS-uriADENQRyHOLMEkJdFG'
): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  const alphabetLength = alphabet.length
  let result = ''

  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabetLength]
  }

  return result
}

/**
 * Generate a job GUID in the format lqaboss-{nanoid}
 * @returns Job GUID string
 */
export function generateJobGuid(): string {
  return `lqaboss-${nanoidEquivalent()}`
}
