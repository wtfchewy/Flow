import { type AppSettings, applySettings, saveSettingsImmediate } from '../settings/settings';

/**
 * Shows a full-screen welcome/onboarding overlay.
 * Returns a promise that resolves when the user clicks "Get Started".
 */
export function showWelcome(settings: AppSettings): Promise<void> {
  // Load Kalam font for the "Draw," text
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Kalam:wght@400&display=swap';
  document.head.appendChild(fontLink);

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'peak-welcome-overlay';

    const card = document.createElement('div');
    card.className = 'peak-welcome-card';

    // Title
    const title = document.createElement('h1');
    title.className = 'peak-welcome-title';
    title.innerHTML = `
      <span class="peak-welcome-title-line">
        <span class="peak-welcome-cursor"></span>Write,
      </span>
      <span class="peak-welcome-title-draw">Draw,</span>
      <span class="peak-welcome-title-line">
        <svg class="peak-welcome-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="5" fill="var(--affine-primary-color, #1e6fff)"/>
          <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>Plan,
      </span>
      <br/>
      <span class="peak-welcome-title-peak">at your Peak.</span>
    `;
    card.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'peak-welcome-subtitle';
    subtitle.textContent = 'Configure your preferences to get started.';
    card.appendChild(subtitle);

    // Settings section
    const settingsSection = document.createElement('div');
    settingsSection.className = 'peak-welcome-settings';

    // Theme
    const themeRow = createRow('Theme', 'Choose light or dark mode');
    const themeControl = createSegmentedControl(
      ['Light', 'Dark'],
      settings.theme === 'dark' ? 1 : 0,
      (index) => {
        settings.theme = index === 0 ? 'light' : 'dark';
        applySettings(settings);
      }
    );
    themeRow.appendChild(themeControl);
    settingsSection.appendChild(themeRow);

    // Vibrancy
    const vibrancyRow = createRow('Vibrancy', 'Translucent background effect');
    const vibrancyToggle = createSwitch(settings.vibrancy, (on) => {
      settings.vibrancy = on;
      applySettings(settings);
    });
    vibrancyRow.appendChild(vibrancyToggle);
    settingsSection.appendChild(vibrancyRow);

    // iCloud Sync
    const icloudRow = createRow('iCloud Sync', 'Sync your notes across devices');
    const icloudToggle = createSwitch(settings.icloudSync, (on) => {
      settings.icloudSync = on;
    });
    icloudRow.appendChild(icloudToggle);
    settingsSection.appendChild(icloudRow);

    card.appendChild(settingsSection);

    // Get Started button
    const btn = document.createElement('button');
    btn.className = 'peak-welcome-btn';

    const btnText = document.createElement('span');
    btnText.className = 'peak-welcome-btn-text';
    btnText.textContent = 'Get Started';
    btn.appendChild(btnText);

    const btnArrow = document.createElement('span');
    btnArrow.className = 'peak-welcome-btn-arrow';
    btnArrow.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"/></svg>`;
    btn.appendChild(btnArrow);

    btn.addEventListener('click', async () => {
      settings.onboarded = true;
      await saveSettingsImmediate(settings);
      overlay.classList.add('dismissing');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 350);
    });
    card.appendChild(btn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

function createRow(label: string, description?: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'peak-settings-row';

  const textWrap = document.createElement('div');
  textWrap.className = 'peak-settings-row-text';

  const labelEl = document.createElement('span');
  labelEl.className = 'peak-settings-label';
  labelEl.textContent = label;
  textWrap.appendChild(labelEl);

  if (description) {
    const descEl = document.createElement('span');
    descEl.className = 'peak-settings-description';
    descEl.textContent = description;
    textWrap.appendChild(descEl);
  }

  row.appendChild(textWrap);
  return row;
}

function createSegmentedControl(
  labels: string[],
  activeIndex: number,
  onChange: (index: number) => void
): HTMLElement {
  const control = document.createElement('div');
  control.className = 'peak-segmented-control';

  const buttons: HTMLButtonElement[] = [];

  labels.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.className = `peak-segmented-btn${i === activeIndex ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateSliderPos();
      onChange(i);
    });
    buttons.push(btn);
    control.appendChild(btn);
  });

  const slider = document.createElement('div');
  slider.className = 'peak-segmented-slider';
  control.appendChild(slider);

  function updateSliderPos() {
    const activeBtn = buttons.find(b => b.classList.contains('active'));
    if (activeBtn) {
      slider.style.width = `${activeBtn.offsetWidth}px`;
      slider.style.left = `${activeBtn.offsetLeft}px`;
    }
  }

  requestAnimationFrame(() => updateSliderPos());

  return control;
}

function createSwitch(
  on: boolean,
  onChange: (on: boolean) => void
): HTMLElement {
  const sw = document.createElement('button');
  sw.className = `peak-switch${on ? ' on' : ''}`;

  const knob = document.createElement('div');
  knob.className = 'peak-switch-knob';
  sw.appendChild(knob);

  sw.addEventListener('click', () => {
    const isOn = sw.classList.toggle('on');
    onChange(isOn);
  });

  return sw;
}
