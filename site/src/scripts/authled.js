// ضوء الحالة على بوردة صفحات الدخول والتسجيل: طافي ← جاهز ← بيرمش (جاري) ← أحمر (غلط).

/** { filled, busy, error, ok } → 'off' | 'on' | 'busy' | 'err' */
export function ledState({ filled, busy, error, ok }) {
  if (error) return 'err';
  if (busy) return 'busy';
  return filled || ok ? 'on' : 'off';
}

/** بيراقب الكرت (الصفحة بتعيد رسمه بالخطوات) وبيحط data-led على .auth */
export function initAuthLed(main) {
  const box = main.querySelector('.box');
  if (!box) return;
  const read = () => {
    const card = box.querySelector('.card');
    if (!card) return;
    const need = [...card.querySelectorAll('input[autocomplete], select#uni')];
    const filled = need.length ? need.every((el) => el.value.trim() !== '') : !!card.querySelector('.opt.on, .done');
    const msg = card.querySelector('#e');
    const text = (msg?.textContent ?? '').trim();
    main.dataset.led = ledState({
      filled,
      busy: !!card.querySelector('.go[disabled]'),
      error: !!text && msg.classList.contains('err'),
      ok: !!text && msg.classList.contains('ok'),
    });
  };
  box.addEventListener('input', read);
  box.addEventListener('change', read);
  new MutationObserver(read).observe(box, { subtree: true, childList: true, attributes: true, characterData: true });
  read();
}
