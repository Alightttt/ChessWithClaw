export const useRipple = () => (e) => {
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = e.clientX - rect.left - size/2
  const y = e.clientY - rect.top  - size/2
  
  const s = document.createElement('span')
  s.style.cssText = `
    position:absolute;
    width:${size}px;height:${size}px;
    left:${x}px;top:${y}px;
    border-radius:50%;
    background:rgba(255,255,255,0.15);
    transform:scale(0);
    animation:rippleAnim 500ms ease-out forwards;
    pointer-events:none;
    z-index:0;
  `
  btn.appendChild(s)
  setTimeout(() => s.remove(), 500)
}
