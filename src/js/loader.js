(() => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;

    let hidden = false;
    const hideLoader = () => {
        if (hidden) return;
        hidden = true;
        loader.classList.add('is-hidden');
    };

    if (document.readyState !== 'loading') {
        hideLoader();
    } else {
        document.addEventListener('DOMContentLoaded', hideLoader, { once: true });
    }

    // Camera streams and other long-lived media can prevent window.load forever.
    setTimeout(hideLoader, 3000);
})();