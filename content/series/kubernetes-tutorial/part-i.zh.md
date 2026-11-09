---
title: "Part I · 云原生基础与核心抽象"
date: 2026-11-09
layout: "kubernetes-tutorial-part"
---

> 聚焦云原生技术的演进与内核，从云原生起源、设计哲学到 CNCF 生态系统，建立对现代基础设施核心理念的完整认知。<br>
> 无论你是刚接触 K8s 的开发者，还是希望夯实底层基础的系统工程师，这套体系都将为你打通云原生底层逻辑，并为后续深入 AI Infra 奠定坚实的基石。

## 理念、架构与接口

### 云原生基础

理解云原生的定义、设计哲学、应用规范与社区生态，为学习 Kubernetes 建立概念基础，并为后续迈向 AI 原生做好铺垫。

### Kubernetes 架构

深入了解 Kubernetes 的架构设计原理、核心组件及其演进历程。

### 开放接口

了解 Kubernetes 核心开放接口，包括容器运行时接口 (CRI)、容器网络接口 (CNI) 和容器存储接口 (CSI)，以及它们如何实现云原生应用的资源管理和扩展。

## 核心对象与工作负载

### 集群与基础对象

掌握 Kubernetes 集群的基础对象：Node、Namespace、Label、Annotation、污点与容忍，以及对象的垃圾收集机制。

### Pod

深入了解 Kubernetes 中 Pod 这一最小调度单元的构成、生命周期管理以及容器启动机制，掌握 Pod 状态管理的核心概念。

### 工作负载控制器

深入 Kubernetes 内置的工作负载控制器：Deployment、ReplicaSet、StatefulSet、DaemonSet、Job 与 CronJob 的原理、配置与适用场景。

## 调度、网络与存储

### 调度与弹性

系统讲解 Kubernetes 的调度与资源管理：kube-scheduler 原理、调度约束、优先级与抢占、QoS、配额与 LimitRange、kubelet 节点资源管理，以及 HPA/VPA/KEDA、节点自动扩缩与批处理调度器构成的弹性体系。

### 服务发现与路由

理解 Kubernetes 的服务发现与流量路由：Service、CoreDNS、拓扑感知路由、Ingress 与 Ingress 控制器、Gateway API 及其推理扩展。

### 网络

深入 Kubernetes 网络模型与数据面：kube-proxy 的模式演进、IPv4/IPv6 双栈、IP 伪装代理，以及 Flannel、Calico、Cilium 等主流 CNI 插件。

### 存储

深入了解 Kubernetes 存储机制，包括 Secret、ConfigMap、Volume、PV、PVC、StorageClass 等核心存储对象的使用方法和最佳实践。

## 安全与生态

### 身份证与访问控制

全面掌握 Kubernetes 的身份认证与访问控制：认证策略、ServiceAccount、RBAC、结构化认证与鉴权配置、kubeconfig 与 token 认证、kubelet 认证授权、TLS Bootstrap 与证书管理，以及 SPIFFE/SPIRE 工作负载身份。

### CNCF 生态
了解 CNCF 的角色定位、社区治理与规范模型。