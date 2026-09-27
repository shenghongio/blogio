---
title: "什么是 SRE？"
date: 2026-09-22
draft: false
translationKey: directions-zh
layout: directions
labels:
  - SRE
  - 基础
---

为什么要有SRE？
为什么会出现SRE这个岗位呢？这就要从大名鼎鼎的 DevOps 说起了，这个是 Google 高级研发总监 Melody Meckfessel 在2017年提出的理论体系，这套体系是通过构建一些列 DevOps 工具链和标准把研发过程中的各个角色高效整合在一起，高效的产出稳定的交付结果。这个体系打破了研发与运维的边界，使研发期望的构建更多特性而运维期望的不要引入太多的不稳定性的目标合二为一。

DevOps 解决了高效生产稳定服务的流程，使服务的生产迭代周期进一步的缩短。但是随着各个服务的搭建，越来越多的服务都在持续演进着，然而运维维护服务的工作也就越来越多，线上的不稳定状态也就越来越多。那么如何解决这个问题呢？是由开发人员时刻关注着自己的服务么？那整体架构的稳定性又如何保证呢？

由此就产生了 SRE。SRE 的职责就是负责整体站点（服务）的稳定性。然而保证稳定性一定不是在出现问题是解决问题，而是体系化的方式观测与避免问题。这就是我所理解的 SRE 体系。

```shell
#!/bin/bash

set -E -o pipefail

#是连续的主机整体巡检可以用这部分
#定义主机名前缀和范围
prefix="qb-prod-gpu"
start=1
end=200
hosts=()

# 排除的主机名列表
exclude_list=("qb-prod-gpu194")

# 添加不连续的主机名
for i in $(seq -f "%03g" $start $end); do
    hostName="${prefix}${i}"
    
    # 检查当前主机名是否在排除列表中
    exclude=false
    for excluded in "${exclude_list[@]}"; do
        if [[ "$hostName" == "$excluded" ]]; then
            exclude=true
            break
        fi
    done

    # 只有当不在排除列表中时才添加
    if ! $exclude; then
        hosts+=("$hostName")
    fi
done

hosts+=("qb-prod-gpu301")

#指定不连续的主机名

# 主机列表（IP地址或主机名）
# hosts=("qb-prod-gpu040" 
#        "qb-prod-gpu173" 
#        "qb-prod-gpu195" 
#        "qb-prod-gpu148" 
#        )  
#此处请替换为实际密码
password="XXX" 
DIAGNOSE_DIR="/home/ecs-user/diagnose_report/diagnose_gpu_$(date '+%y-%m-%d_%H-%M')"

# 检查并创建诊断目录
if [[ ! -d "${DIAGNOSE_DIR}" ]]; then
    mkdir -p "${DIAGNOSE_DIR}"
fi

DIAGNOSE_LOG_PATH="${DIAGNOSE_DIR}/diagnose_gpu.log"
GPU_NUMS=
declare -a error_messages
declare -a info_messages
# declare -A error_hosts
host=$(hostname)

# 日志文件
FINAL_OUTPUT_FILE="${DIAGNOSE_DIR}/final_diagnose_results.log"
> "$FINAL_OUTPUT_FILE"  # 清空或创建文件

_printf_end_split_line() {
    logger.info "$(printf "%0.s="{0..120} | sed 's/[0-9]//g')"
}

logger.info() {
    
    info_messages+=("  info  $1")  # 将信息添加到数组中
    
}

# 在诊断结束时输出所有信息
_output_info_messages() {
    if [[ ${#info_messages[@]} -ne 0 ]]; then
        echo "=== Info Messages ==="
        for msg in "${info_messages[@]}"; do
            echo "$msg"
        done | tee -a "${DIAGNOSE_LOG_PATH}"
    fi
}

logger.error() {
    error_messages+=("$1: $2")  # 将错误信息添加到数组中
}

# 在诊断结束时输出所有错误信息
_output_error_summary() {
    if [[ ${#error_messages[@]} -ne 0 ]]; then
        # echo "=== Error Messages ==="
        for msg in "${error_messages[@]}"; do
            echo "$msg"
        done | tee -a "${DIAGNOSE_LOG_PATH}"
    fi
}

# 错误记录函数
# logger.error() {
#     local error_type="$1"
#     local message="$2"
#     error_messages+=("  error  $message")  # 将错误信息添加到数组中
#     error_hosts["$error_type"]+="$host "  # 将主机名添加到相应的错误类型
#     for host in ${error_hosts[$error_type]}; do
#         echo "  - $host"
#     done
# }

# _output_error_summary() {
#     if [[ ${#error_hosts[@]} -ne 0 ]]; then
#         echo "=== Error Summary ==="
#         for error_type in "${!error_hosts[@]}"; do
#             echo "Error Type: $error_type"
#             echo "Messages:"
#             for message in "${error_messages[@]}"; do
#                 if [[ "$message" == *"$error_type"* ]]; then
#                     echo "  - $message"
#                 fi
#             done
#             echo "Hosts: ${error_hosts[$error_type]}"
#             echo
#         done
#         echo "======================"
#     fi
# }

logger.echo() {
    echo "        $1" 2>&1 | tee -a "${DIAGNOSE_LOG_PATH}"
}

# 首先确定是否是GPU实例
_diagnose_gpu.is_gpu() {
    local pci_device_path="/sys/bus/pci/devices"
    if [[ ! -d "${pci_device_path}" ]];then
        return 1
    fi

    # shellcheck disable=SC2045
    for device in $(ls "${pci_device_path}");do
        if [[ ! -d "${pci_device_path}/${device}" ]];then
            continue
        fi
        vendor="${pci_device_path}/${device}"/vendor
        if [[ ! -f  "${vendor}" ]];then
            continue
        fi
        vendorId=$(cat "${vendor}")
        if [[ "${vendorId}" == "0x10de" ]];then
            logger.info "the instance is a gpu instance"
            _printf_end_split_line
            return 0
        fi
    done
    logger.error  "NO GPU" "no gpu cards found by pci devices, please confirm the instance is gpu instance"
    _printf_end_split_line
    return 1
}

# 检查是否存在gpu掉卡
_diagnose_gpu.lost_card() {
    local nvidia_smi_card_info
    local nvidia_smi_card_nums
    nvidia_smi_card_info=$(nvidia-smi -L)
    nvidia_smi_card_nums=$(echo "${nvidia_smi_card_info}" | wc -l)
    GPU_NUMS="${nvidia_smi_card_nums}"

    local lspci_card_info
    local lspci_card_num
    lspci_card_info=$(lspci |grep 3D)
    lspci_card_num=$(echo "${lspci_card_info}" | wc -l)
    if [[ "${nvidia_smi_card_nums}" -ne "${lspci_card_num}" ]]; then
        logger.error "Lost Card"  "gpu instance lost card, nvidia_smi_card_nums is ${nvidia_smi_card_nums}  lspci_card_num is ${lsp} ."
        _printf_end_split_line
        return
    fi
    logger.info "gpu instance does not lose card"
    _printf_end_split_line
}

# 检查驱动安装版本是否和内核版本一致
_diagnose_gpu.check_os_and_driver_kernel_version() {
    os_kernel_version=$(uname -r)
    driver_kernel_version=$(modinfo nvidia | grep nvidia.ko | awk -F 'modules/' '{printf $2}' | awk -F '/' '{printf $1}')
    if [[ "${os_kernel_version}" != "${driver_kernel_version}" ]]; then
        logger.error "inconsistent driver version" "os kernel version ${os_kernel_version} is inconsistent with driver's kernel version ${driver_kernel_version} at installation"
        _printf_end_split_line
        return
    fi
    logger.info "os kernel version ${os_kernel_version} is consistent with driver install kernel version ${driver_kernel_version}"
    _printf_end_split_line
    return 
}

_diagnose_nvlink_check(){

    # 获取 NVLink 状态
    nvlink_status=$(nvidia-smi nvlink -s | grep "Link" | grep "inactive" | sed 's/^[[:space:]]*//')

    if [ -n "$nvlink_status" ]; then
        logger.error "NVLink inactive" "错误主机：$(hostname) $nvlink_status"
    else
        logger.info  "NVLink status all active "
    fi

}

# 检查是否存在xid错误
_diagnose_gpu.check_xid_error_in_dmesg() {
    local xid_info
    xid_info=$(journalctl --since "2 days ago" | grep -i "NVRM: Xid" | grep -v "andbox" |grep -v "containerd" |grep -v "kubelet" |grep -v "euid" |grep -v "dhclient"| grep -v "13"  | grep -v "31" | grep -v "43" | grep -v "45"  | grep -v "68"  | grep -v "94" | grep -v "64"   | tail -n 10)
    if [[ -n "${xid_info}" ]]; then
        logger.error "Xid Error" "错误主机：$(hostname): ${xid_info}"
        logger.error "Please refer to the documentation:  https://docs.nvidia.com/deploy/pdf/XID_Errors.pdf"
        _printf_end_split_line
        return
    fi
    logger.info "the instance doesn't have xid error"
    _printf_end_split_line
}



# 收集nvidia-smi的详细信息，查看是否有ecc等报错
_diagnose_gpu.check_nvidia_smi_detail() {
    for((gpu_id=0;gpu_id<"${GPU_NUMS}";gpu_id++));
    do
        _diagnose_gpu.check_temperatures "${gpu_id}"
        _diagnose_gpu.check_pstate "${gpu_id}"
        local ecc_mode
        if ! _diagnose_gpu.check_ecc_mode "${gpu_id}"; then
            logger.error "ECC ERROR" "错误主机：$(hostname): ecc mode is not enabled, please enable it"
            _printf_end_split_line
            continue
        fi
        #  为0则证明没有发生数据损坏，不为0请检查
        if _diagnose_gpu.is_exist_sram; then
            local sram_ecc_count
            local dram_ecc_count

            sram_ecc_count=$(_diagnose_gpu.check_sram_ecc_count "${gpu_id}")
            dram_ecc_count=$(_diagnose_gpu.check_dram_ecc_count "${gpu_id}")
            if [[ "$sram_ecc_count" -ne 0 ]] || [[ "$dram_ecc_count" -ne 0 ]]; then
                logger.error "Data Corruption" "错误主机：$(hostname): ECC errors detected: SRAM count=${sram_ecc_count}, DRAM count=${dram_ecc_count}. Please check for data corruption on GPU ID ${gpu_id}."
            else
                logger.info "No data corruption detected for GPU ID ${gpu_id}."
            fi
        else
            local volatile_ecc_count
            local aggregate_ecc_count
            local retired_pages_ecc_count

            volatile_ecc_count=$(_diagnose_gpu.check_volatile_ecc_count "${gpu_id}")
            aggregate_ecc_count=$(_diagnose_gpu.check_aggregate_ecc_count "${gpu_id}")
            retired_pages_ecc_count=$(_diagnose_gpu.check_retired_pages_ecc_count "${gpu_id}")

            # 检查是否有任何一个计数不为 0
            if [[ "$volatile_ecc_count" -ne 0 ]] || [[ "$aggregate_ecc_count" -ne 0 ]] || [[ "$retired_pages_ecc_count" -ne 0 ]]; then
                logger.error "Data Corruption" "错误主机：$(hostname): ECC errors detected: Volatile count=${volatile_ecc_count}, Aggregate count=${aggregate_ecc_count}, Retired pages count=${retired_pages_ecc_count}. Please check for data corruption on GPU ID ${gpu_id}."
            else
                logger.info "No data corruption detected for GPU ID ${gpu_id}."
            fi
            
        fi
    done
}

_diagnose_gpu.is_exist_sram() {
    local sram_info
    sram_info=$(nvidia-smi -q | grep -i sram)
    if [[ -n "${sram_info}" ]]; then
        logger.info "the gpu is after ampere architecture"
        return 0
    fi
    logger.info "the gpu is before ampere architecture"
    return 1
}

_diagnose_gpu.check_dram_ecc_count() {
    local gpu_id=$1
    local value_list
    value_list=$(nvidia-smi -i "${gpu_id}" --query-remapped-rows=remapped_rows.correctable,remapped_rows.uncorrectable --format=csv,noheader,nounits)
    local dram_ecc_count_info
    local gpu_bus_id
    dram_ecc_count_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=","
    value_array=(${dram_ecc_count_info})
    local correctable="${value_array[0]}"
    local uncorrectable="${value_array[1]}"
    logger.info "correctable dram ecc count is ${correctable}"
    if [[ "${correctable}" != *"N/A"* && "${correctable}" -gt 1000 ]]; then
        logger.error "Correctable DRAM ECC Error" "错误主机：$(hostname): gpu ${gpu_id} instance need restart due to correctable dram ecc count more than 1000"
    fi
    logger.info "uncorrectable dram ecc count is ${uncorrectable}"
    if [[ "${uncorrectable}" != *"N/A"* && "${uncorrectable}" -gt 60 ]]; then
        logger.error "Uncorrectable DRAM ECC Errors" "错误主机：$(hostname): gpu ${gpu_id} instance need restart due to uncorrectable dram ecc count more than 60"
    fi
    _printf_end_split_line
}

_diagnose_gpu.check_sram_ecc_count() {
    local gpu_id=$1
    local value_list
    local sram_ecc_count_info
    local gpu_bus_id
    value_list=$(nvidia-smi -i "${gpu_id}" --query-gpu=pci.bus_id,ecc.errors.corrected.volatile.sram,ecc.errors.corrected.aggregate.sram --format=csv,noheader,nounits)
    sram_ecc_count_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=","
    value_array=(${sram_ecc_count_info})
    gpu_bus_id="${value_array[0]}"
    local volatile_sram_ecc_count="${value_array[1]}"
    local aggregate_sram_ecc_count="${value_array[2]}"
    if [[ "${volatile_sram_ecc_count}" -gt 4 ]]; then
        logger.error "Hardware Malfunction" "错误主机：$(hostname): gpu ${gpu_bus_id} have hardware malfunction due to volatile sram ecc count ${volatile_sram_ecc_count} more than 4"
    fi
    if [[ "${aggregate_sram_ecc_count}" -gt 4 ]]; then
        logger.error "Hardware Malfunction" "错误主机：$(hostname):  gpu ${gpu_bus_id} have hardware malfunction due to aggregate sram ecc count ${aggregate_sram_ecc_count} more than 4"
    fi
    logger.info "volatile sram ecc count is ${volatile_sram_ecc_count}"
    logger.info "aggregate sram ecc count is ${aggregate_sram_ecc_count}"
    _printf_end_split_line
}

_diagnose_gpu.check_retired_pages_ecc_count() {
    local gpu_id=$1
    local value_list
    value_list=$(nvidia-smi -i "${gpu_id}" --query-gpu=pci.bus_id,retired_pages.single_bit_ecc.count, \
                                                      retired_pages.double_bit.count, \
                                                      retired_pages.pending --format=csv,noheader,nounits)
    local retired_pages_ecc_count_info
    local gpu_bus_id
    retired_pages_ecc_count_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=","
    value_array=(${retired_pages_ecc_count_info})
    gpu_bus_id="${value_array[0]}"
    local retired_pages_ecc_count
    retired_pages_ecc_count=$((value_array[1] + value_array[2]))
    if [[ "${retired_pages_ecc_count}" -gt 60 ]]; then
        logger.error "Hardware Malfunction" "错误主机：$(hostname):  gpu ${gpu_bus_id} have hardware malfunction due to double_bit_ecc count and single_bit_ecc more than 60"
    fi
    if [[ "${value_array[2]}" == "yes" ]]; then
        logger.error "Hardware Malfunction" "错误主机：$(hostname):  the instance need restart to recover retired pages "
    fi
    logger.info "retired pages ecc count is ${aggregate_ecc_count}"
    _printf_end_split_line
}

_diagnose_gpu.check_aggregate_ecc_count() {
    local gpu_id=$1
    local value_list
    value_list=$(nvidia-smi -i "${gpu_id}" --query-gpu=pci.bus_id,ecc.errors.corrected.aggregate.device_memory,ecc.errors.corrected.aggregate.register_file,ecc.errors.corrected.aggregate.l1_cache,ecc.errors.corrected.aggregate.l2_cache,ecc.errors.corrected.aggregate.texture_memory,ecc.errors.corrected.aggregate.total --format=csv,noheader,nounits)
    local aggregate_ecc_count_info
    local gpu_bus_id
    aggregate_ecc_count_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=","
    value_array=(${aggregate_ecc_count_info})
    gpu_bus_id="${value_array[0]}"
    local aggregate_ecc_count
    aggregate_ecc_count=$((value_array[6] - value_array[1]))
    if [[ "${aggregate_ecc_count}" -gt 5 ]]; then
        logger.error "Hardware Malfunction"  "错误主机：$(hostname):  gpu ${gpu_bus_id} have hardware malfunction due to that aggregate ecc count more than 5"
    fi
    logger.info "aggregate ecc count is ${aggregate_ecc_count}"
    _printf_end_split_line
}

_diagnose_gpu.check_volatile_ecc_count() {
    local gpu_id=$1
    local value_list
    value_list=$(nvidia-smi -i "${gpu_id}" --query-gpu=pci.bus_id,ecc.errors.corrected.volatile.device_memory,ecc.errors.corrected.volatile.register_file,ecc.errors.corrected.volatile.l1_cache,ecc.errors.corrected.volatile.l2_cache,ecc.errors.corrected.volatile.texture_memory,ecc.errors.corrected.volatile.total --format=csv,noheader,nounits)
    local volatile_ecc_count_info
    local gpu_bus_id
    volatile_ecc_count_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=","
    value_array=(${volatile_ecc_count_info})
    gpu_bus_id="${value_array[0]}"
    local volatile_ecc_count
    volatile_ecc_count=$((value_array[6] - value_array[1]))
    if [[ "${volatile_ecc_count}" -gt 5 ]]; then
        logger.error "Hardware Malfunction"  "错误主机：$(hostname):  gpu ${gpu_bus_id} have hardware malfunction due to volatile ecc count more than 5"
    fi
    logger.info "volatile ecc count is ${volatile_ecc_count}"
    _printf_end_split_line
}

_diagnose_gpu.check_ecc_mode() {
    local gpu_id=$1
    local value_list
    value_list=$(nvidia-smi -i "${gpu_id}" --query-gpu=pci.bus_id,ecc.mode.current --format=csv,noheader,nounits)
    local ecc_mode_info
    local value_array
    local gpu_bus_id
    local ecc_mode
    ecc_mode_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=","
    value_array=(${ecc_mode_info})
    gpu_bus_id="${value_array[0]}"
    ecc_mode="${value_array[1]}"
    logger.info "gpu ${gpu_bus_id} ecc mode is ${ecc_mode}"
    if [[ ${ecc_mode} != "Enabled" ]]; then
        logger.error "Configuration Error"  "错误主机：$(hostname):  ecc mode is ${ecc_mode}"
        return 1
    fi
    _printf_end_split_line
}

_diagnose_gpu.check_temperatures() {
    local gpu_id=$1
    local value_list
    value_list=$(nvidia-smi -i "${gpu_id}" --query-gpu=pci.bus_id,temperature.gpu --format=csv,noheader,nounits)
    # shellcheck disable=SC2001
    local temp_info
    local value_array
    local gpu_bus_id
    local gpu_core_temp
    temp_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=',' read -r gpu_bus_id gpu_core_temp <<< "$(echo "${temp_info}" | tr -d ' ')"
    local max_core_op_temp=75
    
    if [[ "${gpu_core_temp}" -ge "${max_core_op_temp}" ]]; then
        logger.error "Temperature too high" "错误主机：$(hostname):  gpu ${gpu_id} core temperature is ${gpu_core_temp}  and  greater than max operating temperature 80C, please stop working and stop instance"
        _printf_end_split_line
        return
    fi
    logger.info "gpu ${gpu_id} temperature normal"
    _printf_end_split_line 
}

_diagnose_gpu.check_pstate() {
    local gpu_id=$1
    local value_list
    value_list=$(nvidia-smi -i "${gpu_id}" --query-gpu=pci.bus_id,pstate --format=csv,noheader,nounits)
    local temp_info
    local value_array
    local gpu_bus_id
    local gpu_pstate_level
    pstate_info=$(echo "${value_list}" | sed s/[[:space:]]//g)
    IFS=","
    value_array=(${pstate_info})
    gpu_bus_id="${value_array[0]}"
    gpu_pstate_level="${value_array[1]}"
    logger.info "gpu ${gpu_bus_id} pstate level ${gpu_pstate_level}"
    logger.info "if pstate is not in p0 ~ p15, please restart instance to recover it"
    _printf_end_split_line
}

_diagnose_gpu.check_network() {
    CONFIG_FILE="/etc/netplan/00-installer-config.yaml"
    awk -F ': ' '
        BEGIN {
            device_count = 0;  
            in_ethernets = 0;  
        }
    
        /^  ethernets:/ {
            in_ethernets = 1;
            next;
        }
    
        /^  bonds:/ {
            in_ethernets = 0;  
            next;
        }
    
        in_ethernets && /^[[:space:]]*([a-zA-Z0-9_-]+):/ {
            if ($1 ~ /^[[:space:]]*(enp|ens)/) {
                device_name = $1;  
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", device_name);
                gsub(/:$/, "", device_name);
                if (current_device != "") {
                    print_device_info(current_device, has_table, has_via, ip);
                }
                current_device = device_name;
                has_table = 0;
                has_via = 0;
                ip = "";
            }
        }
    
        in_ethernets && /table:/ { has_table = 1; }
        in_ethernets && /via:/ {
            if (current_device) {
                has_via = 1;
                split($0, a, " ");
                for (i in a) {
                    if (a[i] == "via:") {
                        ip = a[i+1];
                        break;
                    }
                }
            }
        }
    
        END {
            if (current_device != "") {
                print_device_info(current_device, has_table, has_via, ip);
            }
            cmd = "hostname";
            cmd | getline hostname;
            close(cmd);
            
            # printf("当前主机：%s 的有效GPU卡总数为: %d\n", hostname, device_count)  ;
            if (device_count != 8) {
               printf("网络配置错误：主机 %s 配置的有效 GPU 卡总数为 %d，期望值为 8。\n", hostname, device_count) ;
            }
           
           
        }
    
        function print_device_info(device, table_found, via_found, ip) {
            if (table_found && via_found) {
                device_count++;
                # printf("GPU卡名为 %s，网卡 IP 地址为 %s\n", device, ip);   
            
                delete device_ip;  # 清空数组
                ip_count = 0;  # 重置计数
           

                cmd = "ip a | grep -w " device " | grep inet | awk '\''{print $2}'\'' | cut -d'\''/'\'' -f1";

                while (cmd | getline line) {
                    device_ip[ip_count++] = line;  # 存储 IP 地址
                }
                close(cmd);
                cmd = "hostname";
                cmd | getline hostname;
                close(cmd);

                status_cmd ="ip a show " device " | grep -w state | awk '\''{print $2}'\''";
                status_cmd | getline device_status ;
                close(status_cmd);

                if (device_status == "DOWN") {
                    printf("错误主机: %s, GPU卡 %s 的状态为 DOWN\n", hostname, device);
                    return ;
                }
                
                
                if (ip_count == 1) {
                    ping_cmd = "ping -c 1 " ip " -I " device_ip[0];
                    output = "";  # 初始化输出变量
                    while (ping_cmd | getline ping_result) {
                        output = output ping_result "\n";  # 拼接每一行
                    }
                    close(ping_cmd);
    
                    if (output ~ /1 received/) {
                        # printf("GPU卡 %s 到网关 IP %s 的联通性检测通过\n", device, ip);
    
                    } else {
                        printf("GPU卡联通性错误 GPU卡 %s 到网关 IP %s 的联通性检测未通过\n", device, ip) ;
                        printf("错误主机: %s, GPU卡名: %s\n", hostname, device) ;
                        printf("执行的检测命令为： %s \n",ping_cmd);
                    }
                } else if(ip_count > 1){
                    printf("错误主机: %s,GPU卡 %s 找到多个 IP 地址:\n", hostname,device);
                    for (i = 0; i < ip_count; i++) {
                        printf("GPU卡 %s ,IP 地址 %d: %s\n", device,i + 1, device_ip[i]);
                    }
                } else
                {
                    printf("错误主机: %s, 未找到GPU卡 %s 的 IP 地址\n", hostname,device);
                }
            }
        }
    ' "$CONFIG_FILE"
}

_diagnose_gpu.collect_driver_install_log() {
    cp /var/log/nvidia-installer.log "${DIAGNOSE_DIR}"
    logger.info "success to collect nvidia driver install log"
    _printf_end_split_line
}

_diagnose_gpu.collect_log() {
    _diagnose_gpu.collect_driver_install_log
}

_diagnose_gpu.run() {
    local current_hostname
    current_hostname=$(hostname)  # 获取当前主机名
    # echo "Diagnosing GPU on host: ${current_hostname}"  # 输出主机名
    # echo "now start diagnosing gpu"
    if ! _diagnose_gpu.is_gpu; then
        logger.error "Not GPU" "错误主机：$(hostname):  the instance is not a gpu instance, skip collecting gpu diagnose information"
        return 1
    fi
   
    _diagnose_gpu.lost_card
    _diagnose_gpu.check_os_and_driver_kernel_version
    _diagnose_nvlink_check
    _diagnose_gpu.check_xid_error_in_dmesg
    _diagnose_gpu.check_nvidia_smi_detail
    _diagnose_gpu.collect_log
    _diagnose_gpu.check_network
}

diagnose_gpu() {
    # logger.info "now start diagnosing gpu"
    if ! _diagnose_gpu.run; then
        return 1
    fi
    _output_error_summary
    # echo "gpu diagnosis ended "
}

# 在远程主机上执行的函数
_run_on_host() {
    local host="$1"
    local output_file="/tmp/diagnose_gpu_output.log"
    # echo "Diagnosing GPU on host: ${host}"

    # 检查是否可以连接到主机
    if sshpass -p "$password" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$host" "exit" 2>/dev/null; then
        # 复制脚本并执行
        sshpass -p "$password" scp -o StrictHostKeyChecking=no "${BASH_SOURCE[0]}" "$host:/tmp/diagnose_gpu.sh"
        sshpass -p "$password" ssh -o StrictHostKeyChecking=no "$host" "bash /tmp/diagnose_gpu.sh diagnose_gpu > ${output_file} 2>&1"

        # 将结果保存到本地
        sshpass -p "$password" scp -o StrictHostKeyChecking=no "$host:${output_file}" "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log"
        # if [ -f "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log" ] && [ -s "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log" ]; then
        #     non_empty_lines=$(grep -c '^[^[:space:]]' "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log")
        #     if [ "$non_empty_lines" -gt 0 ]; then
        #         cat "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log" >> "$FINAL_OUTPUT_FILE"
        #     fi
        # fi
        if [ -f "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log" ] && [ -s "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log" ]; then
            # 直接将内容追加到最终输出文件
            cat "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log" >> "$FINAL_OUTPUT_FILE"
        fi
      
        # rm -f "${DIAGNOSE_DIR}/diagnose_gpu_output_${host}.log"
    else
        echo "无法连接到主机 ${host}. 请检查主机状态或网络连接." >> "$FINAL_OUTPUT_FILE"
    fi

    
}

# 遍历主机
diagnose_on_hosts() {
    # echo "遍历主机执行巡检中，请等待"
    for host in "${hosts[@]}"; do
        _run_on_host "$host" &
    done
    wait  # 等待所有后台任务完成
    echo "GPU diagnose report is saved in ${DIAGNOSE_DIR}"
    if [ -s "$FINAL_OUTPUT_FILE" ]; then
        echo "本次巡检发现的GPU问题如下: "
        cat "$FINAL_OUTPUT_FILE"
    else
        echo "没有发现GPU问题" 
    fi
}

if [[ $# -gt 0 ]]; then
    
    # 使用 case 语句调用对应的函数
    case "$1" in
        diagnose_gpu)
            diagnose_gpu
            ;;
        *)
            echo "Function '$1' not provided. Exiting."
            exit 1
            ;;
    esac
else
    # 没有传参时遍历主机
    diagnose_on_hosts
fi

# echo "GPU diagnosis completed."

START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
START_DAY=$(date -u +"%Y-%m-%dT")

# 发送结果到飞书
if [[ -s "$FINAL_OUTPUT_FILE" ]]; then
  message="**$START_DAY GPU巡检如下：**\n"
  while IFS= read -r line; do
    message+="$line\n"
  done < "$FINAL_OUTPUT_FILE"

  echo "$message"

else
  message="没有发现GPU问题"
  exit 1
fi

# 构建发送的 URL
SEND_URL="http://10.252.177.151:8080/prometheusalert?type=fs&tpl=prometheus-fs-test&fsurl=https://open.feishu.cn/open-apis/bot/v2/hook/e0a6f5fd-0f71-4f69-9201-51ad5ff8f7f7"

# 消息内容
MESSAGE='{
           "alerts": [
             {
               "status": "warning",
               "labels": {},
               "annotations": {},
               "startsAt": "'"$START_TIME"'",
               "endsAt": "'"$START_TIME"'",
               "message": "'"$message"'"
             }
           ]
         }'

# 发送消息
curl -X POST "$SEND_URL" \
     -H "Content-Type: application/json" \
     -d "$MESSAGE"

echo "send success"

```