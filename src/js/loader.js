(() => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;

    const hideLoader = () => loader.classList.add('is-hidden');

    if (document.readyState === 'complete') {
        hideLoader();
    } else {
        window.addEventListener('load', hideLoader, { once: true });
    }
})();