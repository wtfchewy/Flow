import { type AppSettings, applySettings, saveSettingsImmediate } from '../settings/settings';

/**
 * Shows a full-screen welcome/onboarding overlay with settings configuration.
 * Returns a promise that resolves when the user clicks "Let's Go".
 */
export function showWelcome(settings: AppSettings): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'flow-welcome-overlay';

    const card = document.createElement('div');
    card.className = 'flow-welcome-card';

    // Title
    const title = document.createElement('h1');
    title.className = 'flow-welcome-title';
    title.textContent = 'Welcome to Flow';
    card.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'flow-welcome-subtitle';
    subtitle.textContent = 'Set up your workspace before getting started.';
    card.appendChild(subtitle);

    // Settings section
    const settingsSection = document.createElement('div');
    settingsSection.className = 'flow-welcome-settings';

    // Theme
    const themeRow = createRow('Appearance');
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
    const vibrancyRow = createRow('Vibrancy');
    const vibrancyToggle = createSwitch(settings.vibrancy, (on) => {
      settings.vibrancy = on;
      applySettings(settings);
    });
    vibrancyRow.appendChild(vibrancyToggle);
    settingsSection.appendChild(vibrancyRow);

    // Blur
    const blurRow = createRow('Blur');
    const blurSlider = createSlider(0, 80, settings.vibrancyBlur, (val) => {
      settings.vibrancyBlur = val;
      applySettings(settings);
    });
    blurRow.appendChild(blurSlider);
    settingsSection.appendChild(blurRow);

    // Opacity
    const opacityRow = createRow('Opacity');
    const opacitySlider = createSlider(0, 0.6, settings.vibrancyOpacity, (val) => {
      settings.vibrancyOpacity = Math.round(val * 100) / 100;
      applySettings(settings);
    }, 0.01);
    opacityRow.appendChild(opacitySlider);
    settingsSection.appendChild(opacityRow);

    card.appendChild(settingsSection);

    // Let's Go button
    const btn = document.createElement('button');
    btn.className = 'flow-welcome-btn';
    btn.textContent = "Let's Go";
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

function createRow(label: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'flow-settings-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'flow-settings-label';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  return row;
}

function createSegmentedControl(
  labels: string[],
  activeIndex: number,
  onChange: (index: number) => void
): HTMLElement {
  const control = document.createElement('div');
  control.className = 'flow-segmented-control';

  const buttons: HTMLButtonElement[] = [];

  labels.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.className = `flow-segmented-btn${i === activeIndex ? ' active' : ''}`;
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
  slider.className = 'flow-segmented-slider';
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
  sw.className = `flow-switch${on ? ' on' : ''}`;

  const knob = document.createElement('div');
  knob.className = 'flow-switch-knob';
  sw.appendChild(knob);

  sw.addEventListener('click', () => {
    const isOn = sw.classList.toggle('on');
    onChange(isOn);
  });

  return sw;
}

function createSlider(
  min: number,
  max: number,
  value: number,
  onChange: (val: number) => void,
  step?: number
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flow-slider-wrapper';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'flow-slider';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step ?? 1);
  input.value = String(value);

  updateSliderFill(input);

  input.addEventListener('input', () => {
    updateSliderFill(input);
    onChange(parseFloat(input.value));
  });

  wrapper.appendChild(input);
  return wrapper;
}

function updateSliderFill(input: HTMLInputElement) {
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}
