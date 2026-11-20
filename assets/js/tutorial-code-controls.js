(function () {
    'use strict';

    var rootSelector = '.post-content, .kt-markdown';
    var blockSelector = '.highlight';

    var setCollapsed = function (wrapper, button, collapsed) {
        wrapper.classList.toggle('tutorial-code-block--collapsed', collapsed);
        button.textContent = collapsed ? '展开' : '折叠';
        button.setAttribute('aria-expanded', String(!collapsed));
        button.setAttribute('aria-label', collapsed ? '展开代码' : '折叠代码');
    };

    var copyText = function (text) {
        if (navigator.clipboard && window.isSecureContext) {
            return Promise.resolve().then(function () {
                return navigator.clipboard.writeText(text);
            });
        }

        return new Promise(function (resolve, reject) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            try {
                document.body.appendChild(textarea);
                textarea.select();
                if (!document.execCommand || !document.execCommand('copy')) {
                    throw new Error('Clipboard copy was rejected');
                }
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                textarea.remove();
            }
        });
    };

    var decorateBlock = function (block) {
        if (block.closest('.tutorial-code-block')) return;
        var pre = block.querySelector('pre');
        if (!pre) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'tutorial-code-block tutorial-code-block--collapsed';

        var toolbar = document.createElement('div');
        toolbar.className = 'tutorial-code-toolbar';
        toolbar.setAttribute('role', 'group');
        toolbar.setAttribute('aria-label', '代码操作');

        var content = document.createElement('div');
        content.className = 'tutorial-code-content';

        var status = document.createElement('span');
        status.className = 'tutorial-code-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        var foldButton = document.createElement('button');
        foldButton.type = 'button';
        foldButton.className = 'tutorial-code-action';
        setCollapsed(wrapper, foldButton, true);
        foldButton.addEventListener('click', function () {
            setCollapsed(wrapper, foldButton, !wrapper.classList.contains('tutorial-code-block--collapsed'));
        });

        var runButton = document.createElement('button');
        runButton.type = 'button';
        runButton.className = 'tutorial-code-action';
        runButton.textContent = '运行';
        runButton.setAttribute('aria-label', '运行代码');
        runButton.addEventListener('click', function () {
            window.alert('运行功能尚未开放，后续会在此处提供示例运行说明。当前不会执行代码，也不会向外发送代码。');
        });

        var copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'tutorial-code-action';
        copyButton.textContent = '复制代码';
        copyButton.setAttribute('aria-label', '复制代码');
        copyButton.addEventListener('click', function () {
            copyText(pre.textContent).then(function () {
                copyButton.textContent = '已复制';
                status.textContent = '代码已复制到剪贴板';
                window.setTimeout(function () {
                    copyButton.textContent = '复制代码';
                    status.textContent = '';
                }, 1600);
            }).catch(function (error) {
                console.error('Unable to copy code block', error);
                copyButton.textContent = '复制失败';
                status.textContent = '复制失败，请检查浏览器剪贴板权限';
                window.setTimeout(function () {
                    copyButton.textContent = '复制代码';
                    status.textContent = '';
                }, 2400);
            });
        });

        var code = pre.querySelector('code');
        var language = code ? (code.getAttribute('data-lang') || '') : '';
        var languageLabels = {
            go: 'Go',
            yaml: 'YAML',
            yml: 'YAML',
            json: 'JSON',
            shell: 'Shell',
            bash: 'Bash',
            sh: 'Shell',
            text: 'Text',
            plaintext: 'Text'
        };
        var languageLabel = document.createElement('span');
        languageLabel.className = 'tutorial-code-language';
        languageLabel.textContent = languageLabels[language.toLowerCase()] ||
            (language ? language.charAt(0).toUpperCase() + language.slice(1) : 'Text');

        toolbar.appendChild(foldButton);
        toolbar.appendChild(runButton);
        toolbar.appendChild(copyButton);
        toolbar.appendChild(languageLabel);
        toolbar.appendChild(status);

        block.parentNode.insertBefore(wrapper, block);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(content);
        content.appendChild(block);
    };

    var decorateRoot = function (root) {
        root.querySelectorAll(blockSelector).forEach(decorateBlock);
    };

    document.querySelectorAll(rootSelector).forEach(decorateRoot);

    var viewer = document.querySelector('.kt-article-viewer');
    if (!viewer) return;

    var observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
            record.addedNodes.forEach(function (node) {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (node.matches(blockSelector)) {
                    if (node.closest(rootSelector)) decorateBlock(node);
                    return;
                }
                if (node.matches(rootSelector)) {
                    decorateRoot(node);
                    return;
                }
                node.querySelectorAll(rootSelector).forEach(decorateRoot);
            });
        });
    });

    observer.observe(viewer, { childList: true, subtree: true });
})();
