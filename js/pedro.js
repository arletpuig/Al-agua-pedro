// Control de la caricatura: expresiones, bocadillos y animaciones de cuerpo entero.
const $ = s => document.querySelector(s);
const pedro = $('#pedro'), chair = $('#chair'), bubble = $('#bubble'), bubblePos = $('#bubble-pos'), bubbleBg = $('#bubble-bg'), bubbleText = $('#bubble-text');
const MOODS = ['laugh', 'shock', 'angry', 'smug'];
let bubbleTimer = null;

export const HEAD_POS = { x: 590, y: 135 };     // posición del bocadillo cuando está en la silla
export const WATER_POS = { x: 500, y: 455 };    // posición del bocadillo cuando está en el agua

export function mood(m) { MOODS.forEach(c => pedro.classList.remove(c)); if (m) pedro.classList.add(m); }
export function wet(v) { pedro.classList.toggle('wet', v); }
export function oneShot(cls, ms) { pedro.classList.remove(cls); void pedro.getBoundingClientRect(); pedro.classList.add(cls); setTimeout(() => pedro.classList.remove(cls), ms); }

function wrap(text, max = 20) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
  if (cur.trim()) lines.push(cur.trim()); return lines;
}
export function say(text, ms = 2200, pos = HEAD_POS) {
  clearTimeout(bubbleTimer);
  const lines = wrap(text);
  bubbleText.innerHTML = lines.map((l, i) => `<tspan x="0" dy="${i ? 20 : 0}">${l}</tspan>`).join('');
  bubble.classList.remove('on'); bubblePos.setAttribute('transform', `translate(${pos.x},${pos.y})`);
  const w = Math.max(80, bubbleText.getBBox().width + 30), h = lines.length * 20 + 18, tail = pos === HEAD_POS ? -w / 2 + 24 : w / 2 - 24;
  bubbleText.setAttribute('y', -h + 26);
  bubbleBg.setAttribute('d', `M${-w / 2 + 12},${-h} h${w - 24} q12,0 12,12 v${h - 24} q0,12 -12,12 H${tail + 16} l${pos === HEAD_POS ? -24 : 8},18 l${pos === HEAD_POS ? 8 : -24},-18 H${-w / 2 + 12} q-12,0 -12,-12 v${-(h - 24)} q0,-12 12,-12z`);
  void bubble.getBoundingClientRect(); bubble.classList.add('on');
  bubbleTimer = setTimeout(() => bubble.classList.remove('on'), ms);
}
export function hush() { clearTimeout(bubbleTimer); bubble.classList.remove('on'); }

function anim(el, frames, opts) { el.getAnimations().forEach(a => a.cancel()); return el.animate(frames, { fill: 'forwards', ...opts }); }
export const body = {
  fall: () => anim(pedro, [
    { transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-40px,-40px) rotate(-30deg)', offset: .3 }, { transform: 'translate(-110px,300px) rotate(-130deg)' }
  ], { duration: 1000, easing: 'cubic-bezier(.4,0,.9,.6)' }),
  sink: () => anim(pedro, [{ transform: 'translate(-110px,300px) rotate(-130deg)', opacity: 1 }, { transform: 'translate(-110px,360px) rotate(-150deg)', opacity: 0 }], { duration: 350, easing: 'ease-in' }),
  surface: () => anim(pedro, [
    { transform: 'translate(-110px,360px) rotate(0)', opacity: 0 }, { transform: 'translate(-110px,245px) rotate(-4deg)', opacity: 1, offset: .35 },
    { transform: 'translate(-110px,262px) rotate(3deg)', offset: .7 }, { transform: 'translate(-110px,258px) rotate(-2deg)' }
  ], { duration: 1400, easing: 'ease-out' }),
  dive: () => anim(pedro, [{ transform: 'translate(-110px,258px)', opacity: 1 }, { transform: 'translate(-110px,370px)', opacity: 0 }], { duration: 500, easing: 'ease-in' }),
  respawn: () => anim(pedro, [{ transform: 'translate(0,-140px) scale(.9)', opacity: 0 }, { transform: 'translate(0,10px) scale(1.03)', opacity: 1, offset: .65 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: 650, easing: 'ease-out' }),
  reset: () => { pedro.getAnimations().forEach(a => a.cancel()); },
};
export const seat = {
  tilt: () => anim(chair, [{ transform: 'rotate(0)' }, { transform: 'rotate(-10deg)', offset: .3 }, { transform: 'rotate(-75deg) translate(-20px,10px)' }], { duration: 700, easing: 'ease-in' }),
  reset: () => anim(chair, [{ transform: 'rotate(-75deg) translate(-20px,10px)' }, { transform: 'rotate(6deg)', offset: .7 }, { transform: 'rotate(0)' }], { duration: 500, easing: 'ease-out' }),
  shake: () => anim(chair, [{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg)', offset: .2 }, { transform: 'rotate(5deg)', offset: .4 }, { transform: 'rotate(-3deg)', offset: .6 }, { transform: 'rotate(2deg)', offset: .8 }, { transform: 'rotate(0)' }], { duration: 700 }),
};

export const LINES = {
  miss: ['JAJAJA, ¿eso es todo?', '¡Ni me has rozado!', 'Con esa puntería no entras ni en el Congreso', '¿Eso era un tomate o una disculpa?', 'Tranquilo, yo también fallo... promesas', 'Lanzas peor que la oposición', '¡Sigue practicando, campeón!', 'Esto va al Falcon directo'],
  near: ['¡Uy! Eso ha estado cerca...', '¡Casi me caigo! Pero no.', 'Resisto más que una legislatura', '¡Me has despeinado!', 'Aún sigo aquí, como siempre'],
  wetWater: ['¡GLUB! ¡Esto es un ataque!', '¡Mi traje! ¡Era de Moncloa!', '¡No sé nadar en esto!', '¡Esto es juego sucio!', '¡Pido una comisión de investigación!'],
  wetChair: ['Mojado, pero no derrotado', 'Vale, esa te la concedo', 'Esto lo vas a pagar', 'Tengo frío. Me quejaré en rueda de prensa', 'No dimito. Ni mojado.'],
  tomato: ['¿Otro tomate? Qué miedo...', 'Eso es un huerto, no un arma', 'Ya puedes apuntar bien', 'Hmm... prefiero las croquetas'],
  idle: ['¿Te vas a quedar ahí mirando?', 'Puedes seguir clicando, no tengo prisa', 'Qué bien se está aquí sentado', 'Nadie me mueve de esta silla', 'La piscina está muy lejos, ¿no?'],
};
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
