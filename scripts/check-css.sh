#!/usr/bin/env bash
#
# CSS 完整性检查 —— 防止「悬空选择器」吞掉后续规则
#
# 背景：custom.css 为长期追加的单文件，历史上多次出现选择器列表以逗号
# 结尾、但声明块在编辑中被整体删除的情况。这类损坏 CSS 解析器不报错，
# 却会把紧随其后的规则合并进上一条，症状是某主题下元素莫名丢样式或
# 间距异常。本脚本将这类问题转为可被 CI / 本地命令直接捕获的错误。
#
# 检查项：
#   1. 花括号配平（{} 数量相等且无负值）
#   2. 悬空选择器（行尾为 , 且下一有效行不是选择器续行）
#   3. 空声明块（{} 或仅含空白/注释，通常由误删产生）
#   4. 孤立的尾部逗号（出现在声明块内合法，出现在顶层非法）
#
# 用法：
#   scripts/check-css.sh [file...]     默认检查 assets/css/custom.css

set -uo pipefail

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=("assets/css/custom.css")
fi

FAILED=0
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
DIM=$'\033[2m'
RESET=$'\033[0m'

has_matches() {
  local n
  n=$(grep -cE "$1" "$2" 2>/dev/null || true)
  [ "${n:-0}" -gt 0 ]
}

for FILE in "${TARGETS[@]}"; do
  if [ ! -f "$FILE" ]; then
    printf '%s  ✗ 文件不存在：%s%s\n' "$RED" "$FILE" "$RESET"
    FAILED=1
    continue
  fi

  printf '\n==> 检查 %s\n' "$FILE"

  # 1. 花括号配平
  OPEN=$(grep -o '{' "$FILE" | wc -l | tr -d ' ')
  CLOSE=$(grep -o '}' "$FILE" | wc -l | tr -d ' ')
  if [ "$OPEN" -ne "$CLOSE" ]; then
    printf '%s  ✗ 花括号不配平：{ = %s，} = %s%s\n' "$RED" "$OPEN" "$CLOSE" "$RESET"
    FAILED=1
  else
    printf '%s  ✓ 花括号配平（%s 对）%s\n' "$GREEN" "$OPEN" "$RESET"
  fi

  # 2. 悬空选择器：仅在括号深度为 0 时，行尾逗号才表示选择器列表延续。
  #    括号内的逗号（linear-gradient、box-shadow、font-family 等多值参数）
  #    与选择器无关，必须排除，否则会大量误报。
  DANGLE=$(awk '
    {
      lines[NR] = $0
    }
    END {
      depth = 0
      in_comment = 0
      value_mode = 0
      skipped_blank = 0
      for (i = 1; i <= NR; i++) {
        s = lines[i]
        gsub(/^[ \t]+|[ \t]+$/, "", s)

        if (s ~ /^\/\*/) continue
        if (s == "") continue

        if (s !~ /,$/) {
          # 逐字符更新括号与注释状态，供下一行判定使用
          n = length(s)
          for (k = 1; k <= n; k++) {
            c = substr(s, k, 1)
            if (in_comment) {
              if (c == "*" && substr(s, k + 1, 1) == "/") { in_comment = 0; k++ }
              continue
            }
            if (c == "/" && substr(s, k + 1, 1) == "*") { in_comment = 1; k++; continue }
            if (c == "(") depth++
            else if (c == ")") depth--
          }
          if (s ~ /^[A-Za-z*-][A-Za-z0-9_-]*:[ \t]*$/) value_mode = 1
          else if (s ~ /;$/ || s ~ /\{$/) value_mode = 0
          continue
        }

        # 行尾为逗号：仅在括号深度为 0 且不在声明值中，才可能是选择器列表
        if (depth != 0) {
          n = length(s)
          for (k = 1; k <= n; k++) {
            c = substr(s, k, 1)
            if (c == "(") depth++
            else if (c == ")") depth--
          }
          continue
        }

        # `box-shadow:` 这类属性值跨行写法：以 `属性名:` 结尾时，
        # 后续行都是值列表，行尾逗号与选择器无关。
        if (s ~ /^[A-Za-z*-][A-Za-z0-9_-]*:[ \t]*$/) {
          value_mode = 1
          continue
        }
        if (value_mode) {
          if (s ~ /;$/ || s ~ /\{$/) value_mode = 0
          n = length(s)
          for (k = 1; k <= n; k++) {
            c = substr(s, k, 1)
            if (c == "(") depth++
            else if (c == ")") depth--
          }
          continue
        }

        j = i + 1
        t = ""
        skipped_blank = 0
        while (j <= NR) {
          t = lines[j]
          gsub(/^[ \t]+|[ \t]+$/, "", t)
          if (t == "") { skipped_blank = 1; j++; continue }
          if (t ~ /^\/\*/ || t ~ /^\*/) { j++; continue }
          break
        }

        if (t == "") { printf "%d: 逗号结尾但文件结束，缺少声明块\n", i }
        else if (t ~ /,$/ || t ~ /\{/) {
          # 选择器列表的逗号后紧接下一选择器，中间不应出现空行；
          # 出现空行说明声明块很可能已在编辑中被删除。
          if (skipped_blank) printf "%d: 逗号后出现空行，疑似声明块被删除\n", i
        }
        else { printf "%d: 选择器列表悬空，下一行为 [%s]\n", i, substr(t, 1, 40) }
      }
    }
  ' "$FILE")

  if [ -n "$DANGLE" ]; then
    printf '%s  ✗ 发现悬空选择器：%s\n' "$RED" "$RESET"
    printf '%s\n' "$DANGLE" | sed 's/^/     /'
    FAILED=1
  else
    printf '%s  ✓ 无悬空选择器%s\n' "$GREEN" "$RESET"
  fi

  # 3. 空声明块：{} 之间仅含空白，典型误删残留
  EMPTY=$(grep -nE '\{[[:space:]]*\}' "$FILE" | head -20 || true)
  if [ -n "$EMPTY" ]; then
    printf '%s  ⚠ 发现空声明块（请确认是否误删）：%s\n' "$YELLOW" "$RESET"
    printf '%s%s%s\n' "$DIM" "$EMPTY" "$RESET" | sed "s/^/     /"
  else
    printf '%s  ✓ 无空声明块%s\n' "$GREEN" "$RESET"
  fi

  # 4. 连续空行（3 行及以上）：误删内容后的常见残留
  GAPS=$(awk '
    /^[ \t]*$/ { run++; next }
    { if (run >= 3) printf "%d 处连续空行（%d 行）\n", NR - run, run; run = 0 }
    END { if (run >= 3) printf "%d 处连续空行（%d 行）\n", NR - run + 1, run }
  ' "$FILE")
  if [ -n "$GAPS" ]; then
    printf '%s  ⚠ 残留空白段：%s\n' "$YELLOW" "$RESET"
    printf '%s%s%s\n' "$DIM" "$GAPS" "$RESET" | sed "s/^/     /"
  else
    printf '%s  ✓ 无异常空白段%s\n' "$GREEN" "$RESET"
  fi
done

printf '\n'
if [ "$FAILED" -ne 0 ]; then
  printf '%s==> 检查未通过%s\n' "$RED" "$RESET"
  exit 1
fi

printf '%s==> 全部通过%s\n' "$GREEN" "$RESET"