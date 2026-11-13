(function () {
    var self = document.currentScript || document.querySelector('script[data-mermaid-cdn]');
    var CDN_SRC = self ? (self.getAttribute('data-mermaid-cdn') || '') : '';
    var LIB_SRC = self ? (self.getAttribute('data-mermaid-lib') || '') : '';
    var TIME_BUDGET = 4000;

    function log(msg) {
        if (window.console) console.log('[mermaid] ' + msg);
    }
    function warn(msg) {
        if (window.console) console.warn('[mermaid] ' + msg);
    }

    log('init start | cdn=' + (CDN_SRC || 'none') + ' | local=' + (LIB_SRC || 'none'));

    if (!CDN_SRC && !LIB_SRC) {
        warn('no source configured, abort');
        return;
    }

    var nodes = document.querySelectorAll('.mermaid');
    log('found ' + nodes.length + ' mermaid nodes');

    if (typeof Promise === 'undefined' || typeof Promise.any !== 'function') {
        warn('Promise.any unsupported, using sequential fallback');
    }

    var sources = {};

    function capture(el) {
        if (!el.id) {
            el.id = 'mermaid-auto-' + Math.random().toString(36).slice(2, 8);
        }
        if (typeof sources[el.id] === 'undefined') {
            sources[el.id] = el.textContent;
        }
        return el.id;
    }

    nodes.forEach(capture);

    var libPromise = null;

    function inject(src, label) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.setAttribute('data-mermaid-source', label);
            s.onload = function () {
                log(label + ' script onload');
                resolve();
            };
            s.onerror = function () {
                warn(label + ' script onerror: ' + src);
                reject(new Error(label + ' load failed'));
            };
            document.head.appendChild(s);
        });
    }

    function waitForGlobal() {
        return new Promise(function (resolve, reject) {
            if (window.mermaid) return resolve(window.mermaid);
            var elapsed = 0;
            var tick = 50;
            var timer = setInterval(function () {
                elapsed += tick;
                if (window.mermaid) {
                    clearInterval(timer);
                    log('global mermaid detected after ' + elapsed + 'ms');
                    return resolve(window.mermaid);
                }
                if (elapsed >= TIME_BUDGET) {
                    clearInterval(timer);
                    reject(new Error('global timeout after ' + elapsed + 'ms'));
                }
            }, tick);
        });
    }

    function settleFirst(srcList) {
        if (typeof Promise.any === 'function') {
            return Promise.any(srcList);
        }
        return new Promise(function (resolve, reject) {
            var failed = 0;
            var total = srcList.length;
            srcList.forEach(function (p) {
                p.then(resolve, function (e) {
                    failed += 1;
                    if (failed === total) reject(e);
                });
            });
        });
    }

    function loadLib() {
        if (window.mermaid) return Promise.resolve(window.mermaid);
        if (libPromise) return libPromise;

        var list = [];
        if (CDN_SRC) list.push(inject(CDN_SRC, 'cdn').then(waitForGlobal));
        if (LIB_SRC) list.push(inject(LIB_SRC, 'local').then(waitForGlobal));

        libPromise = settleFirst(list).catch(function (err) {
            libPromise = null;
            throw err;
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
            log('rendering ' + el.id);
            return mermaid.run({ nodes: [el] }).then(function () {
                el.setAttribute('data-mermaid-done', '1');
                el.removeAttribute('data-mermaid-error');
                log('rendered ok: ' + el.id);
            });
        }).catch(function (err) {
            warn('render failed: ' + el.id + ' | ' + (err && err.message ? err.message : err));
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
                        log('viewport hit: ' + e.target.id);
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

    var domObserver = new MutationObserver(function (records) {
        var found = false;
        records.forEach(function (r) {
            r.addedNodes.forEach(function (n) {
                if (n.nodeType !== 1) return;
                if (n.classList && n.classList.contains('mermaid')) {
                    capture(n);
                    enqueue(n);
                    found = true;
                } else if (n.querySelectorAll) {
                    var inner = n.querySelectorAll('.mermaid');
                    if (inner.length) {
                        inner.forEach(function (el) { capture(el); enqueue(el); });
                        found = true;
                    }
                }
            });
        });
        if (found) log('dynamic mermaid nodes detected');
    });
    domObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });
})();