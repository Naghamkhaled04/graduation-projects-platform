// بيبني سكربت القفل اللي بينحقن inline بأول <head> بكل صفحة مقفولة (Base.astro).
// بيفشل مسكّر: أي خطأ (حتى لو المتصفح حاجب التخزين) = إخفاء الصفحة وتحويل للدخول.
export function inlineGuard(guardSrc) {
  return guardSrc.replace(/^export /gm, '') + `
(function(){
  var go = function(u){ document.documentElement.style.visibility = 'hidden'; location.replace(u); };
  try { var s; try { s = localStorage; } catch (e) {} if (!hasSession(s)) go(loginUrl(location)); }
  catch (e) { go('/login'); }
})();`;
}
