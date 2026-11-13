---
title: "这个博客的导航是怎么自动长出来的"
date: 2026-11-09
description: "记录一次从静态 yaml 列表到内容驱动导航的重构：浮窗如何自动发现新系列、空系列如何自己消失，以及文章体系为什么只留一级。"
tcf: "Hugo"
cover:
  image: "images/04.jpg"
---

## 起点：一个会撒谎的列表

最初的浮窗导航是一份写死在模板里的数组。它知道「AI 工程」「云原生」「语言与工具」这些分组名，但并不知道这些分组底下到底有没有内容。结果是每加一个新的系列，都得改模板；而某个分组写完了文章，前面还挂着一条 `url: '#'` 的占位条目，点进去什么也没有。

静态列表的根本问题不是"要改代码"，而是**它会撒谎**——它声称的入口和实际存在的内容之间没有任何约束关系。只要两者靠人手动对齐，就一定会歪。

所以这次重构只围绕一个原则：**导航应该是内容的投影，而不是内容的声明。**

## 第一步：让系列自己暴露归属

每个系列都在 `_index.md` 的 front matter 里写一个 `stackGroup` 字段：

```yaml
---
title: "Kubernetes 教程"
stackGroup: "云原生"
Weight: 10
---
```

这相当于给系列贴了个标签，告诉模板"我归哪一组"。模板不再硬编码任何系列名，只需要拿着分组名去反查：

```go
{{- $groups := slice
    (dict "name" "AI 工程"    "icon" "ai")
    (dict "name" "云原生"      "icon" "cn")
    (dict "name" "语言与工具"  "icon" "ai")
-}}

{{- range $group := $groups -}}
  {{- $series := slice -}}
  {{- range site.Sections -}}
    {{- if eq .Section "series" -}}
      {{- range .Sections -}}
        {{- if eq (.Params.stackGroup | default "") $group.name -}}
          {{- $series = $series | append . -}}
        {{- end -}}
      {{- end -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
```

分组名是固定的（决定视觉顺序），但分组**下面有什么**完全由内容决定。新增系列只要在 `_index.md` 写一行 `stackGroup`，浮窗就自动多一项，模板一行都不用动。

## 第二步：空分组要能自己闭嘴

有了归属还不够。一个分组如果没有任何文章，它仍然会渲染出一个光秃秃的标题，比死链更难看——死链至少还能说明"这里本该有东西"。

判断一个系列有没有内容，不能用 `len .Pages`，因为它会把 `_index` 自己也算进去，永远大于 0。真正的判据是 `RegularPages`——只数真实子页面：

```go
{{- if gt (len .RegularPages) 0 -}}
  {{- $series = $series | append . -}}
{{- end -}}
```

加上这个条件后，「安全」「SRE 体系」「个人思考」这些只有目录骨架、还没有文章的系列自动消失了。分组标题只在至少有一个真实系列时才渲染：

```go
{{- if gt (len $series) 0 -}}
<div class="gs-stack-group">
    ...
</div>
{{- end -}}
```

这里有个容易踩的坑：`slice` 的累加顺序。如果先判断分组再收集系列，`$series` 在判断时还是空的，整组会被误杀。正确顺序是先把系列收齐，再判断数量——这也是为什么上面的代码把 `if gt (len $series) 0` 放在 range 之后。

## 第三步：文章放弃二级分类

文章体系最初设计成三级：`/articles/` 根页 → 类别卡片 → 类别内文章列表。想法很好，一层层收敛，但实际用起来多了一次不必要的点击——用户点「文章」是为了看到文章，而不是先看八个类别盒子。

改成两级只需要一个变量：`append` 把每个类别子目录的 `RegularPages` 摊平，再整体按日期倒序。

```go
{{- $articles := slice -}}
{{ if .Parent.IsSection }}
{{- $articles = .RegularPages.ByDate.Reverse -}}
{{ else }}
{{- range .Sections -}}
{{- $articles = $articles | append .RegularPages -}}
{{- end -}}
{{- $articles = $articles.ByDate.Reverse -}}
{{ end }}
```

同一个模板同时服务两种页面：直接访问 `/articles/kubernetes/` 时 `.Parent.IsSection` 为真，只列本类别；访问 `/articles/` 时把所有类别摊平。类别目录仍然保留，只是不再是必经路径，卡片上用 `CurrentSection.Title` 标出归属。

## 第四步：入口只留一层

「文章」的入口一度出现了三次：浮窗里一个、导航栏下拉里一个、下拉里还有一个和标题同名的条目。前两个是设计意图，第三个是纯冗余。

修法是让**标题本身成为链接**，而不是"标题 + 下面挂一条同名条目"：

```go
{{- with where hugo.Data.blog_links "category" "articles" -}}
{{- $first := index . 0 -}}
<div class="blog-column blog-column--action">
    <a class="blog-column-header blog-column-header--article" href="{{ $first.url | relLangURL }}">
        <svg .../>
        <span class="blog-column-header-label">{{ i18n "articles_title" }}</span>
    </a>
</div>
{{- end -}}
```

浮窗这边同理，用带箭头的链接替代"可展开分组"：

```go
<div class="gs-stack-group gs-stack-group--link">
    <a class="gs-stack-group-head gs-stack-group-head--link" href="{{ $articles.RelPermalink }}">
        ...
        <svg class="gs-stack-group-arrow">右箭头</svg>
    </a>
</div>
```

箭头是给用户看的**行为提示**：右尖角意味着"跳走"，下尖角意味着"展开"。这个区分不需要文字说明。

## 加载与渲染机制

浮窗本身是纯服务端渲染的——`stack-picker.html` 在构建时就把所有分组和链接算好写进 HTML，前端**没有任何异步请求**。这样做的好处是没有首屏闪烁，也没有"点了才加载"的空窗期。

交互层只负责三件事，全部在 `stack-fab.html` 里的一段 IIFE（立即调用函数表达式）中：

1. **拖拽定位**：`pointerdown / pointermove / pointerup` 三件套，位移超过 5px 才判定为拖拽，避免误触。位置存进 `localStorage`，刷新后原地不动。
2. **拖拽与点击的区分**：如果发生了拖拽，click 事件里 `e.stopPropagation()` 直接返回，防止"拖完顺手打开浮窗"。
3. **开关与关闭**：点击图标 toggle，点遮罩或按 Escape 关闭，打开时 `body.style.overflow = 'hidden'` 锁滚动。

拖拽坐标做了边界钳制，保证按钮不会被拖出视口：

```js
var clampPos = function(l, t){
    var w = btn.offsetWidth, h = btn.offsetHeight;
    var maxL = window.innerWidth - w - 4;
    var maxT = window.innerHeight - h - 4;
    return {
        left: Math.max(4, Math.min(l, maxL)),
        top: Math.max(4, Math.min(t, maxT))
    };
};
```

## 一个和渲染无关的坑

测试时加的示例文章怎么都不出现在列表里，排查了很久才发现：**Hugo 会把日期为当天（UTC 零点）的文章判定为 future，默认不构建**。跑一次 `hugo list future` 就能看到它们被列在待构建队列里。

所以写完文章如果发现列表里没有，先确认：

```bash
hugo list future
```

要么把 `date` 写成前一天，要么构建时加 `--buildFuture`。这跟模板完全无关，但很容易被误判成模板 bug——值得单独记一笔。

## 小结

整套改造下来，模板里没有任何一个系列名、文章名被硬编码。模板只认两样东西：`stackGroup` 这个标签，和 `RegularPages` 这个数量。前者说"我属于谁"，后者说"我有没有内容"。

导航变成了一面镜子：内容有什么，它就显示什么；内容搬走了，它就安静地少一行。这才是导航该有的样子。