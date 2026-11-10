---
title: "HPA 调优实践"
date: 2026-11-09
description: "一次线上 HPA 频繁扩缩容的排查与参数调优记录。"
tcf: "Kubernetes"
---

## 背景

集群中某个 Deployment 出现频繁扩缩容抖动，CPU 使用率在阈值附近震荡。

## 排查过程

1. 确认 metrics-server 采集间隔为 15s
2. 观察 stabilizationWindowSeconds 设置过短
3. 调整 behavior 参数

## 结论

将 `scaleDown.stabilizationWindowSeconds` 从 0 调整为 300s 后抖动消失。