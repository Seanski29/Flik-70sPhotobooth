const filterSocket = io('http://localhost:3001');
const filterSoundSources = {
    bill: '../../assets/bill.m4a',
    green: '../../assets/green.mp3',
    red: '../../assets/red.mp3',
    switch: '../../assets/switch.mp3',
    arcade: '../../assets/arcade.mp3'
};
const filterSounds = Object.fromEntries(
    Object.entries(filterSoundSources).map(([name, source]) => [name, new Audio(source)])
);

document.body.addEventListener('click', () => {
    Object.values(filterSounds).forEach(audio => {
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
        }).catch(() => {});
    });
}, { once: true });

filterSocket.on('sound_effect', name => {
    const source = filterSounds[name];
    if (!source) return;
    const effect = source.cloneNode();
    effect.volume = source.volume;
    effect.play().catch(() => {});
});

const filterDefaults = {
    NORMAL: { name: 'Normal', intensity: 100, grayscale: 0, sepia: 0, contrast: 100, brightness: 100, saturation: 100, hue: 0, invert: 0, blur: 0 },
    NOIR: { name: 'Noir', intensity: 100, grayscale: 100, sepia: 0, contrast: 140, brightness: 95, saturation: 100, hue: 0, invert: 0, blur: 0 },
    FILM_II: { name: 'Film II', intensity: 100, grayscale: 0, sepia: 20, contrast: 110, brightness: 100, saturation: 180, hue: -5, invert: 0, blur: 0 }
};
let savedFilters = structuredClone(filterDefaults);
let draftFilters = structuredClone(filterDefaults);

const preview = document.getElementById('filter-preview');
const select = document.getElementById('filter-select');
const message = document.getElementById('filter-message');
const status = document.getElementById('hardware-status');
const fieldKeys = ['intensity', 'grayscale', 'sepia', 'contrast', 'brightness', 'saturation', 'hue', 'invert', 'blur'];

const liveViewUrl = 'http://127.0.0.1:5513/liveview.jpg';
const refreshLiveView = () => {
    preview.src = `${liveViewUrl}?t=${Date.now()}`;
};
setInterval(refreshLiveView, 200);

function cssFilter(filter) {
    const amount = Number(filter.intensity) / 100;
    const scale = (value, neutral) => neutral + (Number(value) - neutral) * amount;
    return [
        `grayscale(${scale(filter.grayscale, 0)}%)`,
        `sepia(${scale(filter.sepia, 0)}%)`,
        `contrast(${scale(filter.contrast, 100)}%)`,
        `brightness(${scale(filter.brightness, 100)}%)`,
        `saturate(${scale(filter.saturation, 100)}%)`,
        `hue-rotate(${Number(filter.hue) * amount}deg)`,
        `invert(${scale(filter.invert, 0)}%)`,
        `blur(${Number(filter.blur) * amount}px)`
    ].join(' ');
}

function renderDraft() {
    const filter = draftFilters[select.value];
    preview.style.filter = cssFilter(filter);
    fieldKeys.forEach(key => {
        const input = document.getElementById(key);
        const output = document.querySelector(`[data-output="${key}"]`);
        input.value = filter[key];
        if (output) output.textContent = key === 'hue' ? `${filter[key]}°` : key === 'blur' ? `${Number(filter[key]).toFixed(1)}px` : `${filter[key]}%`;
    });
}

function setMessage(text, type) {
    message.textContent = text;
    message.className = `filter-message ${type || ''}`;
}

select.addEventListener('change', renderDraft);
document.querySelectorAll('.filter-control input').forEach(input => {
    input.addEventListener('input', () => {
        const filter = draftFilters[select.value];
        filter[input.id] = input.type === 'range' ? Number(input.value) : input.value;
        renderDraft();
        setMessage('Unsaved preview changes', 'warning');
    });
});

document.getElementById('reset-filter').addEventListener('click', () => {
    draftFilters[select.value] = structuredClone(filterDefaults[select.value]);
    renderDraft();
    setMessage('Preset reset locally. Save Filters to keep it.', 'warning');
});

document.getElementById('save-filters').addEventListener('click', () => {
    filterSocket.emit('save_filters', draftFilters);
    savedFilters = structuredClone(draftFilters);
    setMessage('Filter presets saved. The Arduino toggle still controls the active session.', 'success');
});

filterSocket.on('connect', () => filterSocket.emit('request_sync'));
filterSocket.on('filter_config', filters => {
    savedFilters = structuredClone({ ...filterDefaults, ...filters });
    draftFilters = structuredClone(savedFilters);
    renderDraft();
    status.textContent = 'Saved presets loaded';
});
filterSocket.on('filter_error', error => setMessage(error, 'error'));

renderDraft();
