const dns = require('dns');
const { promisify } = require('util');

const lookupAsync = promisify(dns.lookup);

function isBlockedIP(ip) {
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('169.254.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  if (ip.startsWith('fd') || ip.startsWith('fc')) return true; // IPv6 unique local addresses
  if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true; // IPv6 link-local
  return false;
}

async function validateWebhookURL(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (url.length > 500) return false
    
    const hostname = parsed.hostname;
    
    // Block localhost and IPv6 loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false;
    
    // Block internal domains
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    
    // Resolve DNS to prevent DNS rebinding to internal IPs
    try {
      const { address } = await lookupAsync(hostname);
      if (isBlockedIP(address)) return false;
    } catch (dnsError) {
      // If DNS resolution fails, it's not a valid webhook URL
      return false;
    }
    
    return true;
  } catch { return false }
}

module.exports = {
  validateWebhookURL
};
