import lottie, { type AnimationItem } from 'lottie-web';
import pageHoverData from './page-hover.json';
import edgelessHoverData from './edgeless-hover.json';

export interface ModeSwitch {
  element: HTMLElement;
  setMode: (mode: 'page' | 'edgeless') => void;
}

function createAnimatedBtn(
  animationData: any,
  title: string,
  onClick: () => void
): { btn: HTMLButtonElement; anim: AnimationItem } {
  const btn = document.createElement('button');
  btn.className = 'peak-mode-btn';
  btn.title = title;

  const container = document.createElement('div');
  container.className = 'peak-mode-lottie';
  btn.appendChild(container);

  const anim = lottie.loadAnimation({
    container,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    animationData,
  });
  anim.setSpeed(1);

  let forward = true;
  btn.addEventListener('mouseenter', () => {
    anim.setDirection(forward ? 1 : -1);
    anim.play();
    forward = !forward;
  });
  btn.addEventListener('click', onClick);

  return { btn, anim };
}

export function createModeSwitch(onModeChange: (mode: 'page' | 'edgeless') => void): ModeSwitch {
  const toggle = document.createElement('div');
  toggle.className = 'peak-mode-toggle';

  const slider = document.createElement('div');
  slider.className = 'peak-mode-slider';
  toggle.appendChild(slider);

  const { btn: pageBtn } = createAnimatedBtn(
    pageHoverData,
    'Page mode',
    () => onModeChange('page')
  );
  pageBtn.classList.add('active');

  const { btn: edgelessBtn } = createAnimatedBtn(
    edgelessHoverData,
    'Edgeless mode',
    () => onModeChange('edgeless')
  );

  toggle.appendChild(pageBtn);
  toggle.appendChild(edgelessBtn);

  function setMode(mode: 'page' | 'edgeless') {
    if (mode === 'edgeless') {
      edgelessBtn.classList.add('active');
      pageBtn.classList.remove('active');
      toggle.classList.add('edgeless');
    } else {
      pageBtn.classList.add('active');
      edgelessBtn.classList.remove('active');
      toggle.classList.remove('edgeless');
    }
  }

  return { element: toggle, setMode };
}
