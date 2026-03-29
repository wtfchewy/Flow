import { invoke } from '@tauri-apps/api/core';

interface AppSettings {
  theme: string;
  vibrancy: boolean;
  vibrancyOpacity: number;
  vibrancyBlur: number;
}

const defaults: AppSettings = {
  theme: 'dark',
  vibrancy: true,
  vibrancyOpacity: 0.15,
  vibrancyBlur: 40,
};

let overlay: HTMLElement | null = null;

export async function loadSettings(): Promise<AppSettings> {
  const saved = await invoke<Partial<AppSettings>>('load_settings');
  return { ...defaults, ...saved };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveSettingsDebounced(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    invoke('save_settings', { settings: { ...settings } });
  }, 300);
}

async function saveSettingsImmediate(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  await invoke('save_settings', { settings });
}

export function applySettings(settings: AppSettings) {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.classList.toggle('vibrancy', settings.vibrancy);

  const root = document.documentElement.style;
  const rgb = settings.theme === 'light' ? '255, 255, 255' : '0, 0, 0';
  root.setProperty('--flow-vibrancy-bg', `rgba(${rgb}, ${settings.vibrancyOpacity})`);
  root.setProperty('--flow-vibrancy-filter', `blur(${settings.vibrancyBlur}px)`);
}

export function closeSettings() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

export async function openSettings() {
  if (overlay) return;

  const settings = await loadSettings();

  overlay = document.createElement('div');
  overlay.className = 'flow-settings-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });

  const panel = document.createElement('div');
  panel.className = 'flow-settings-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'flow-settings-header';

  const headerText = document.createElement('span');
  headerText.textContent = 'Settings';
  header.appendChild(headerText);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'flow-settings-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeSettings);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Theme setting
  const themeRow = createSettingRow('Appearance');
  const themeToggle = createSegmentedControl(
    ['Light', 'Dark'],
    settings.theme === 'dark' ? 1 : 0,
    async (index) => {
      settings.theme = index === 0 ? 'light' : 'dark';
      applySettings(settings);
      await saveSettingsImmediate(settings);
    }
  );
  themeRow.appendChild(themeToggle);
  panel.appendChild(themeRow);

  // Vibrancy toggle
  const vibrancyRow = createSettingRow('Vibrancy');
  const vibrancyToggle = createSwitch(settings.vibrancy, async (on) => {
    settings.vibrancy = on;
    applySettings(settings);
    await saveSettingsImmediate(settings);
  });
  vibrancyRow.appendChild(vibrancyToggle);
  panel.appendChild(vibrancyRow);

  // Blur slider
  const blurRow = createSettingRow('Blur');
  const blurSlider = createSlider(0, 80, settings.vibrancyBlur, (val) => {
    settings.vibrancyBlur = val;
    applySettings(settings);
    saveSettingsDebounced(settings);
  });
  blurRow.appendChild(blurSlider);
  panel.appendChild(blurRow);

  // Opacity slider
  const opacityRow = createSettingRow('Opacity');
  const opacitySlider = createSlider(0, 0.6, settings.vibrancyOpacity, (val) => {
    settings.vibrancyOpacity = Math.round(val * 100) / 100;
    applySettings(settings);
    saveSettingsDebounced(settings);
  }, 0.01);
  opacityRow.appendChild(opacitySlider);
  panel.appendChild(opacityRow);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function createSettingRow(label: string): HTMLElement {
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

  // Position after render
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

  // Set initial fill
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

// Expose globally so Tauri menu can trigger it
(window as any).__openSettings = openSettings;
