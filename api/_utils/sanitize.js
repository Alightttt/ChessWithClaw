export function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+=/gi, '')
}

export function validateUUID(id) {
  if (typeof id !== 'string') return false;
  const trimmedId = id.trim();
  const uuidRegex = 
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(trimmedId)
}

export function validateUCIMove(move) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
}
