---
title: "Kubernetes 性能优化实战：从资源配额到成本控制"
date: 2026-09-23
draft: false
description: "生产环境 Kubernetes 集群的资源配置、调度优化与成本控制实践。"
tags:
  - Kubernetes
  - Performance
categories:
  - cloud-native
series: kubernetes-tutorial
---

## 为什么 K8s 优化总被忽视

Kubernetes 已经成为容器编排的事实标准，但"跑得起来"和"跑得好"之间有很长的距离。资源浪费、调度延迟、节点碎片化、HPA 抖动——这些问题在集群规模上来之后会逐一暴露。

这篇文章聚焦**生产环境可落地**的优化实践，不谈玩具 Demo，直接给结论和代码。

---

## 资源配额：别让 Pod 抢资源

资源配置是所有优化的起点。配错了，后面再怎么调调度器都是治标不治本。

### 三种 QoS，三种命运

| 场景 | request | limit | 说明 |
| --- | --- | --- | --- |
| Guaranteed | 精确值 | = request | 延迟敏感型服务，比如 API Gateway |
| Burstable | 基线值 | 略高于 request | 大部分业务服务，实际用多少给多少 |
| BestEffort | 不设 | 不设 | 离线任务、可随时被杀的 Job |

### 最常见的反模式

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "1"
    memory: "1Gi"
```

request 和 limit 差距过大，节点上实际能塞的 Pod 数远多于**真实承载能力**。流量一上来，CPU throttle 和 OOM Kill 会同时爆发。

### 用 VPA 拿真实值，别拍脑袋

跑一周的 VPA 观测模式：

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: webapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: webapp-deployment
  updatePolicy:
    updateMode: "Off"
```

`Off` 只推荐不自动改。取 P99 做 limit、P50 做 request，基本不会错。

---

## 调度：让 Pod 落到对的节点

### 节点亲和与反亲和

```yaml
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 80
          preference:
            matchExpressions:
              - key: node-type
                operator: In
                values: ["compute-optimized"]
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values: ["webapp"]
          topologyKey: kubernetes.io/hostname
```

webapp Pod 强制分散到不同节点，避免单点故障；同时优先上 compute-optimized 节点，发挥硬件特性。

### Topology Spread：温和的均匀

反亲和是"要么在要么不在"，拓扑分布约束是"尽量均匀"，更温和也更省资源：

```yaml
spec:
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
      labelSelector:
        matchLabels:
          app: webapp
```

跨可用区最多只差 1 个副本。比 `requiredDuringScheduling` 更灵活，节点紧张时不会阻塞调度。

### Descheduler：运行时 rebalance

调度器只在 Pod 创建时决策，运行时节点负载会慢慢倾斜。开 descheduler：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: descheduler
data:
  policy.yaml: |
    apiVersion: descheduler/v1alpha2
    kind: DeschedulerPolicy
    strategies:
      LowNodeUtilization:
        enabled: true
        params:
          thresholdResource: cpu
          lowThreshold: 20
          highThreshold: 80
          nodeAffinityType:
            - nodeAffinity
```

低利用率节点上的 Pod 会被驱逐到高利用率节点上，让集群整体更紧凑。

---

## HPA：告别抖动式伸缩

### 为什么 HPA 一直在抖

典型写法：

```yaml
minReplicas: 2
maxReplicas: 20
targetCPUUtilizationPercentage: 70
```

只看一个指标、没有冷却、扩容缩容同一个阈值——流量一来猛加副本，流量一走立刻砍掉，新 Pod 还没 warm 完就被回收。

### 生产级配置

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: webapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: webapp-deployment
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

关键改动：

- **多指标**：CPU + Memory + RPS，避免单一指标误判
- **scaleUp 温和但快**：60s 窗口、每次最多加 50%
- **scaleDown 保守**：300s 稳定窗口、每 120s 最多减 1 个——缩容比扩容危险得多

### HPA 副本数计算

```
desiredReplicas = ceil[ currentReplicas × ( currentMetricValue / targetMetricValue ) ]
```

为什么阈值设 70 不是 50？设 50 意味着实际负载超过 50% 就扩容，太敏感；70% 留了 30% 的缓冲应对突刺。

---

## 节点密度：从 70% 到 85%

### 算清楚需要多少节点

```
所需节点数 = ceil( 总 request CPU / 单节点可分配 CPU )
```

单节点可分配 CPU = 节点 CPU - kubelet 预留 - system 预留。用 `kubectl describe node` 看 `Allocatable`，别拿 Capacity 算。

### 给系统留够救命粮

kubelet 参数：

```yaml
kubelet:
  extraArgs:
    system-reserved: "cpu=500m,memory=1Gi"
    kube-reserved: "cpu=500m,memory=1Gi"
    eviction-hard: "memory.available<500Mi,nodefs.available<10%"
```

不给 system 和 kubelet 留够资源，节点会先于 Pod 挂掉。

### 开启 PodTopologySpread 插件

调度器配置里加上：

```yaml
profiles:
  - schedulerName: default-scheduler
    plugins:
      postFilter:
        enabled:
          - name: PodTopologySpread
      preScore:
        enabled:
          - name: PodTopologySpread
      score:
        enabled:
          - name: PodTopologySpread
            weight: 2
```

配合拓扑分布约束一起生效，让调度器在打分阶段就倾向于均匀分布。

---

## 成本控制：终极目标

### 用 Kubecost 看穿钱花在哪

部署 Kubecost，持续观察：

- 哪些 Deployment 的 request 长期远高于实际使用
- 哪些节点利用率常年低于 30%
- idle 资源（已申请但未使用）占比多少

### 常用省钱手段

| 手段 | 预期收益 | 风险 |
| --- | --- | --- |
| VPA 下调 request | 15-30% | 低，观测模式先跑 |
| 清理 BestEffort Pod | 5-10% | 中，确认业务可牺牲 |
| Spot 实例跑 Job | 60-80% | 低，Job 可重跑 |
| 集群缩容（descheduler） | 10-20% | 低 |
| 预留节点换成按需 | 看预留比例 | 中，峰值要扛住 |

---

## 写在最后

Kubernetes 优化没有银弹。正确的顺序是：

1. **先测后调**：VPA 观测真实资源使用
2. **配置打底**：request/limit 对齐 QoS
3. **调度上场**：反亲和 + 拓扑分布 + descheduler
4. **弹性收尾**：多指标 HPA + 非对称伸缩策略
5. **持续观测**：Kubecost + Prometheus，定期 Review

每一条都可以单独落地，不用等全部就绪。