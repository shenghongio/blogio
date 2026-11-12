(function () {
    var root = document.querySelector('[data-sort-root]');
    if (!root) return;

    var target = document.querySelector('[data-sort-target]');
    if (!target) return;

    function applySort(order) {
        var groups = target.querySelectorAll('.article-cat-body');
        groups.forEach(function (body) {
            var rows = Array.prototype.slice.call(body.querySelectorAll('.article-row'));
            rows.sort(function (a, b) {
                var ta = parseInt(a.getAttribute('data-ts'), 10) || 0;
                var tb = parseInt(b.getAttribute('data-ts'), 10) || 0;
                return order === 'date-asc' ? ta - tb : tb - ta;
            });
            rows.forEach(function (row) {
                body.appendChild(row);
            });
        });
    }

    root.addEventListener('click', function (e) {
        var btn = e.target.closest('.article-sort-btn');
        if (!btn) return;
        var order = btn.getAttribute('data-sort');
        root.querySelectorAll('.article-sort-btn').forEach(function (b) {
            b.classList.toggle('is-active', b === btn);
        });
        applySort(order);
    });
})();