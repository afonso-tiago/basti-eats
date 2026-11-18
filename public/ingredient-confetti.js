const ingredients = ['tomato', 'lettuce', 'meat', 'onion', 'cucumber', 'flatbread'];
const frameCount = 9;

export function celebrateRequest(button) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof button.animate !== 'function') return;

  const bounds = button.getBoundingClientRect();
  if (!bounds.width || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;

  const originX = bounds.left + bounds.width / 2;
  const originY = bounds.top + bounds.height / 2;
  const towardCenter = Math.max(-120, Math.min(120, (window.innerWidth / 2 - originX) * 0.65));
  const spread = Math.min(440, window.innerWidth);
  const overlay = document.createElement('div');
  overlay.className = 'ingredient-confetti';
  overlay.setAttribute('aria-hidden', 'true');
  const particles = [];

  for (let index = 0; index < 24; index += 1) {
    const piece = document.createElement('span');
    piece.className = `ingredient ingredient-${ingredients[index % ingredients.length]}`;
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.width = `${15 + Math.random() * 12}px`;
    particles.push(piece);
    overlay.append(piece);
  }
  document.body.append(overlay);

  const animations = particles.map((piece) => {
    const drift = towardCenter + (Math.random() - 0.5) * spread;
    const lift = 210 + Math.random() * 190;
    const drop = 95 + Math.random() * 140;
    const initialAngle = Math.random() * 360;
    const spin = (Math.random() - 0.5) * 720;
    const keyframes = Array.from({ length: frameCount }, (_, index) => {
      const time = index / (frameCount - 1);
      const x = drift * time;
      const y = -lift * time + (lift + drop) * time ** 2;
      return {
        transform: `translate(${x}px, ${y}px) rotate(${initialAngle + spin * time}deg)`,
        opacity: Math.min(1, (1 - time) * 3.5),
      };
    });
    return piece.animate(keyframes, { duration: 750 + Math.random() * 450, fill: 'forwards' });
  });

  Promise.allSettled(animations.map((animation) => animation.finished)).then(() => overlay.remove());
}
