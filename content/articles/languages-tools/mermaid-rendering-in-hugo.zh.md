---
title: "在 Hugo 中稳定渲染 Mermaid 图表"
date: 2026-11-13
description: "从静态页面到 JS 动态加载页面，一套可规模化的 Mermaid 渲染机制的设计与踩坑记录。"
tcf: "Hugo"
cover:
  image: "images/default-cover.jpg"
---

> **一句话概括**
> 静态站点里画图看似简单，真正难的是「图表出现在页面上的每一种方式都要能被渲染」——包括那些内容由 JavaScript 动态加载的页面。这套机制用三个判断条件和两个观察器覆盖了全部场景。

## 背景

博客需要大量架构图、调度流程图。手绘不方便维护，用 Mermaid 写成文本代码块最合适：改一行代码，图自动重画。

但 Hugo 是静态站点生成器，它只负责把 Markdown 变成 HTML，**不会主动渲染 Mermaid**。图表需要在浏览器端由 JavaScript 完成解析和绘制。

最初的做法很简单：在代码块渲染钩子里输出一个容器，再在页面里引入 Mermaid 库。

```go
{{- if eq .Type "mermaid" -}}
<div class="mermaid" id="mermaid-{{ .Ordinal }}">{{ .Inner }}</div>
{{- else -}}
{{- highlight .Inner $lang $opts -}}
{{- end -}}
```

这在纯静态文章页里工作正常。直到图表出现在教程 Part 页上，整段源码以纯文本形式铺在页面中央——**渲染从未发生**。

## 根因分析

排查过程比预想的曲折。关键转折点是发现了两种页面形态的差异。

站点里其实存在两条完全不同的内容渲染路径：

- **路径 A：静态文章页。** Hugo 直接把 Markdown 渲染成 HTML 写进页面，`<div class="mermaid">` 在首屏 HTML 里就已存在。
- **路径 B：动态加载页。** 教程 Part 页为了切换文章不跳转，用 JavaScript `fetch` 目标页 HTML，再取 `.innerHTML` 注入当前容器。

路径 B 的问题在于：

```js
fetch(url)
    .then(function(r){ return r.text(); })
    .then(function(html){
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var data = extractArticle(doc);
        renderArticle(data.title, data.html, ...);
    });
```

而 `innerHTML` 赋值**不会执行插入内容中的 `<script>` 标签**。更要命的是，Part 页自身的 `.Content` 里根本没有 mermaid 容器——它的内容是运行时才注入的。于是脚本注入的判断条件：

```go
{{ if and .IsPage (in .Content "class=\"mermaid\"") }}
```

在 Part 页上恒为假，**脚本从未被注入**。图表容器随内容一起被塞进来了，却没有任何脚本去渲染它。

这就是「本地测通的页面正常、线上访问的页面失败」的原因——测的是路径 A，用户点的是路径 B。

## 设计原则

第一版修复加的是白名单判断：

```go
{{ if in (string .Params.layout) "tutorial-part" }}{{ $needMermaid = true }}{{ end }}
```

这很快暴露了缺陷：Go 教程的 Part 页没有 `layout` 字段，判空后同样不注入。**每新增一个系列、一种页面类型，就得记得改一次判断**，漏了就是线上事故。

白名单式补丁的本质问题是：它要求未来的自己记得所有历史例外。这个要求不现实。

所以最终设计转向两个方向：

**原则一：注入判断按「页面位置」而非「页面类型」。** 一个页面只要位于 `/series/` 下，或内容里出现 mermaid 代码块，就注入脚本。不再枚举 layout 名称。

**原则二：渲染逻辑主动监听 DOM 变化。** 不管容器是静态写入还是运行时注入，只要出现在页面上就能被捕获。

## 实现细节

### 注入判断

```go
{{ $needMermaid := false }}
{{ if or (in .Content "class=\"mermaid\"") (in .RawContent "```mermaid") }}{{ $needMermaid = true }}{{ end }}
{{ if and (not $needMermaid) (in .RelPermalink "/series/") }}{{ $needMermaid = true }}{{ end }}
```

同时检查 `.Content` 和 `.RawContent` 是必要的：前者是渲染后的 HTML，后者是原始 Markdown。代码块里的语言标识在渲染后可能变成 `class="highlight"`，直接检测 ````mermaid` 更可靠。

这个宽松判断不会带来性能代价，因为加载是分层的：

| 层级 | 体积 | 加载时机 |
|---|---|---|
| 初始化脚本 | ~3 KB | 页面进入 `/series/` 或有图时 |
| Mermaid 库 | ~3.4 MB | 页面真实存在 `.mermaid` 节点时才请求 |

没有图表的系列页，脚本执行后找到 0 个节点，进入监听状态，**零网络请求**。

### 动态节点捕获

`innerHTML` 注入不会触发任何既有的生命周期回调，需要用 `MutationObserver` 主动监听：

```js
var domObserver = new MutationObserver(function (records) {
    records.forEach(function (r) {
        r.addedNodes.forEach(function (n) {
            if (n.nodeType !== 1) return;
            if (n.classList && n.classList.contains('mermaid')) {
                capture(n);
                enqueue(n);
            } else if (n.querySelectorAll) {
                n.querySelectorAll('.mermaid').forEach(function (el) {
                    capture(el);
                    enqueue(el);
                });
            }
        });
    });
});
domObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
});
```

两个细节值得注意：

- `subtree: true` 是必须的，因为容器可能嵌套在多层包裹元素里，只监听顶层会漏掉。
- `capture()` 需要为没有 `id` 的节点自动补一个，否则源码缓存的键冲突，主题切换重绘时会拿到空字符串。

### 按需加载与主题重绘

Mermaid 库体积不小，不应当阻塞首屏。用 `IntersectionObserver` 让图表进入视口附近才开始渲染：

```js
var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
        if (e.isIntersecting) {
            io.unobserve(e.target);
            enqueue(e.target);
        }
    });
}, { rootMargin: '300px' });
```

渲染用串行队列而非并发，因为 Mermaid 内部有共享的全局状态，多图同时渲染会出现样式串味：

```js
var queue = Promise.resolve();
function enqueue(el) {
    queue = queue.then(function () { return render(el); });
}
```

主题切换时用 `MutationObserver` 监听 `data-theme` 属性变化，重绘全部图表以匹配配色：

```js
themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
});
```

## 双源加载策略

站点托管在 GitHub Pages，网络环境差异较大。方案是 CDN 与本地库并行请求，谁先成功用谁：

```js
function settleFirst(srcList) {
    if (typeof Promise.any === 'function') return Promise.any(srcList);
    return new Promise(function (resolve, reject) {
        var failed = 0, total = srcList.length;
        srcList.forEach(function (p) {
            p.then(resolve, function (e) { if (++failed === total) reject(e); });
        });
    });
}
```

`Promise.any` 在现代浏览器都支持，但手写降级版本并非多余——某些较旧的 Safari 会在这行抛 `TypeError`，导致整个 IIFE 崩溃且**完全静默**，连报错日志都没有。这类问题最难排查。

## 排查工具

加了日志之后定位效率提升明显。执行阶段的每一步都留痕：

```js
log('init start | cdn=' + cdn + ' | local=' + local);
log('found ' + nodes.length + ' mermaid nodes');
log('viewport hit: ' + id);
log('rendering ' + id);
log('rendered ok: ' + id);
```

一次真实的日志输出：

```
[mermaid] init start | cdn=https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js
[mermaid] found 0 mermaid nodes
[mermaid] dynamic mermaid nodes detected
[mermaid] rendering mermaid-0
[mermaid] rendered ok: mermaid-0
```

第二行的 `found 0` 在动态加载页上是正常现象——初始 HTML 里确实没有图表。整条日志链能一眼看出卡在哪一步。

## 总结

这套机制最终收敛为三个要点：

- **注入判断按位置，不按类型。** `/series/` 路径或内容含 mermaid 代码块即注入，避免枚举 layout 带来的持续维护成本。
- **渲染监听 DOM，不假设时机。** `MutationObserver` 让动态注入的图表与静态图表享有同等处理。
- **加载分层，按需触发。** 3 KB 脚本常驻无害，3.4 MB 库等到真实需要才下载。

回头看，这次排查最大的收获不是修复本身，而是**意识到「我以为的页面」和「用户实际访问的页面」可能走了完全不同的代码路径**。测通一个页面不等于测通一类页面，尤其当前端开始动态拼装内容时。

## 参考链接

- [Mermaid 官方文档](https://mermaid.js.org/)
- [Hugo Render Hooks 文档](https://gohugo.io/render-hooks/code-blocks/)
- [IntersectionObserver API](https://developer.mozilla.org/docs/Web/API/IntersectionObserver)
- [MutationObserver API](https://developer.mozilla.org/docs/Web/API/MutationObserver)