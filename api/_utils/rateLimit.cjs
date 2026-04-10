const rateLimits = new Map();

function checkRateLimit(ip, endpoint, limit, windowMs = 60000) {
  const now = Date.now();
  const key = `${ip}:${endpoint}`;
  
  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
  }
  
  const record = rateLimits.get(key);
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return { allowed: true, remaining: limit - 1, resetTime: record.resetTime };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  
  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
}

module.exports = {
  checkRateLimit
};
