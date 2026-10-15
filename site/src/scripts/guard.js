// قفل الموقع — دوال صافية بدون imports، لأن Base.astro بيحقن هالملف inline بأول <head>.

/** في جلسة دخول؟ (تجريبي أو Supabase) — متزامن، وما بيرمي أبدًا */
export function hasSession(store) {
  try {
    const demo = JSON.parse(store.getItem('community.demo.v1') || 'null');
    if (demo && demo.authed === true) return true;
  } catch (e) { /* JSON خربان أو تخزين محجوب */ }
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && /^sb-.+-auth-token$/.test(k) && (store.getItem(k) || '').indexOf('access_token') !== -1) return true;
    }
  } catch (e) { /* تخزين محجوب */ }
  return false;
}

/** رابط الدخول مع الرجوع لنفس الصفحة */
export function loginUrl(loc) {
  return '/login?next=' + encodeURIComponent(loc.pathname + loc.search);
}

/** next آمن: مسار داخلي بس، وإلا fallback */
export function safeNext(raw, fallback = '/home') {
  return typeof raw === 'string' && /^\/(?![/\\])/.test(raw) ? raw : fallback;
}
