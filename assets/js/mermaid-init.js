(function () {
    var self = document.querySelector('script[data-mermaid-cdn]');
    if (!self) return;
    var CDN_SRC = self.getAttribute('data-mermaid-cdn') || '';
    var LIB_SRC = self.getAttribute('data-mermaid-lib') || '';
    var TIME_BUDGET = 4000;

    var nodes = document.querySelectorAll('.mermaid');
    if (!nodes.length) return;

    var sources = {};
    nodes.forEach(function (el) {
        sources[el.id] = el.textContent;
    });

    var pollTimer = null;
    var libPromise = null;

    function inject(src, label) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.setAttribute('data-mermaid-source', label);
            s.onload = resolve;
            s.onerror = function () { reject(new Error(label + ' load failed')); };
            document.head.appendChild(s);
        });
    }

    function waitForGlobal(deadline) {
        return new Promise(function (resolve, reject) {
            var now = function () { return new Date().getTime(); };
            var check = function () {
                if (window.mermaid) {
                    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
                    return resolve(window.mermaid);
                }
                if (now() > deadline) {
                    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
                    return reject(new Error('mermaid global timeout'));
                }
            };
            if (check() !== undefined) return;
            pollTimer = setInterval(check, 60);
        });
    }

    function loadLib() {
        if (window.mermaid) return Promise.resolve(window.mermaid);
        if (libPromise) return libPromise;

        var startAt = new Date().getTime();
        var deadline = startAt + TIME_BUDGET;

        var raceList = [];
        if (CDN_SRC) {
            raceList.push(inject(CDN_SRC, 'cdn').then(function () {
                return waitForGlobal(deadline);
            }));
        }
        if (LIB_SRC) {
            raceList.push(inject(LIB_SRC, 'local').then(function () {
                return waitForGlobal(deadline);
            }));
        }

        if (!raceList.length) {
            return Promise.reject(new Error('no mermaid source configured'));
        }

        libPromise = Promise.any(raceList).catch(function (errs) {
            libPromise = null;
            throw new Error('all mermaid sources failed: ' + errs.map(function (e) { return e.message; }).join(' | '));
        });

        return libPromise;
    }

    function cfg() {
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            startOnLoad: false,
            theme: dark ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'inherit',
            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis', padding: 12 },
            sequence: { useMaxWidth: true, mirrorActors: false, actorMargin: 60 },
            state: { useMaxWidth: true }
        };
    }

    function renderNode(el) {
        if (!el) return Promise.resolve();
        if (el.getAttribute('data-mermaid-done') === '1') return Promise.resolve();
        return loadLib().then(function (mermaid) {
            mermaid.initialize(cfg());
            var src = sources[el.id];
            if (typeof src === 'undefined') src = el.textContent;
            el.removeAttribute('data-processed');
            el.textContent = src;
            return mermaid.run({ nodes: [el] }).then(function () {
                el.setAttribute('data-mermaid-done', '1');
                el.removeAttribute('data-mermaid-error');
            });
        }).catch(function (err) {
            if (window.console) console.error('[mermaid] render failed:', el.id, err);
            el.setAttribute('data-mermaid-error', '1');
        });
    }

    var queue = Promise.resolve();

    function enqueue(el) {
        queue = queue.then(function () { return renderNode(el); });
        return queue;
    }

    function renderAll() {
        document.querySelectorAll('.mermaid').forEach(function (el) {
            enqueue(el);
        });
    }

    function resetAndRerender() {
        if (window.mermaid) window.mermaid.initialize(cfg());
        document.querySelectorAll('.mermaid').forEach(function (el) {
            el.removeAttribute('data-mermaid-done');
        });
        queue = Promise.resolve();
        renderAll();
    }

    function start() {
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) {
                        io.unobserve(e.target);
                        enqueue(e.target);
                    }
                });
            }, { rootMargin: '300px 0px' });
            document.querySelectorAll('.mermaid').forEach(function (el) {
                io.observe(el);
            });
        } else {
            renderAll();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    var themeObserver = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
            if (records[i].attributeName === 'data-theme') {
                resetAndRerender();
                return;
            }
        }
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
})();