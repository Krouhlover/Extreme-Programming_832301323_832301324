#!/bin/bash

# 一键启动脚本 - Ubuntu
# 用于启动完整的通讯录项目（MySQL + 后端 + 前端 + Nginx）

echo "=========================================="
echo "  通讯录项目一键启动脚本"
echo "=========================================="
echo ""

# 检查 Docker 是否安装（直接尝试运行 docker 命令，最可靠的方式）
DOCKER_INSTALLED=false
DOCKER_VERSION=""

# 方法1: 直接尝试运行 docker --version
if docker --version >/dev/null 2>&1; then
    DOCKER_INSTALLED=true
    DOCKER_VERSION=$(docker --version 2>&1 | head -n1)
elif sudo docker --version >/dev/null 2>&1; then
    DOCKER_INSTALLED=true
    DOCKER_VERSION=$(sudo docker --version 2>&1 | head -n1)
fi

# 如果还没找到，尝试其他方法
if [ "$DOCKER_INSTALLED" = "false" ]; then
    # 方法2: 使用 command -v
    if command -v docker >/dev/null 2>&1; then
        if docker --version >/dev/null 2>&1; then
            DOCKER_INSTALLED=true
            DOCKER_VERSION=$(docker --version 2>&1 | head -n1)
        fi
    fi
fi

# 如果还没找到，尝试 which
if [ "$DOCKER_INSTALLED" = "false" ]; then
    DOCKER_PATH=$(which docker 2>/dev/null)
    if [ -n "$DOCKER_PATH" ] && [ -x "$DOCKER_PATH" ]; then
        if docker --version >/dev/null 2>&1; then
            DOCKER_INSTALLED=true
            DOCKER_VERSION=$(docker --version 2>&1 | head -n1)
        fi
    fi
fi

if [ "$DOCKER_INSTALLED" = "true" ]; then
    echo "✅ 检测到 Docker: $DOCKER_VERSION"
    echo ""
else
    echo "❌ Docker 未安装或无法访问"
    echo ""
    echo "检测到您可能已安装 Docker，但脚本无法访问。"
    echo "请尝试以下方法："
    echo ""
    echo "1. 使用 bash 运行脚本（推荐）："
    echo "   bash start.sh"
    echo ""
    echo "2. 检查 Docker 是否在 PATH 中："
    echo "   which docker"
    echo "   docker --version"
    echo ""
    echo "3. 如果 Docker 需要 sudo，请使用："
    echo "   sudo bash start.sh"
    echo ""
    echo "4. 如果 Docker 未安装，请手动安装："
    echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "   sudo sh get-docker.sh"
    echo "   sudo usermod -aG docker \$USER"
    echo ""
    exit 1
fi

# 检查 Docker 是否可以执行（权限检查）
DOCKER_AVAILABLE=false
if docker ps &> /dev/null; then
    DOCKER_AVAILABLE=true
elif sudo docker ps &> /dev/null; then
    echo "⚠️  检测到需要使用 sudo 执行 Docker 命令"
    echo "💡 建议将当前用户添加到 docker 组："
    echo "   sudo usermod -aG docker \$USER"
    echo "   然后重新登录或运行: newgrp docker"
    echo ""
    if [ -t 0 ]; then
        # 交互式终端，询问用户
        read -p "是否继续使用 sudo 执行 Docker 命令？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        # 非交互式，自动使用 sudo
        echo "非交互式环境，自动使用 sudo 执行 Docker 命令"
    fi
    DOCKER_CMD="sudo docker"
    DOCKER_COMPOSE_CMD="sudo docker-compose"
    DOCKER_AVAILABLE=true
else
    echo "❌ Docker 服务未运行或无法访问"
    echo "尝试启动 Docker 服务..."
    if sudo systemctl start docker 2>/dev/null; then
        sleep 2
        if docker ps &> /dev/null || sudo docker ps &> /dev/null; then
            DOCKER_AVAILABLE=true
            echo "✅ Docker 服务已启动"
        else
            echo "❌ 无法启动 Docker 服务，请检查 Docker 安装"
            exit 1
        fi
    else
        echo "❌ 无法启动 Docker 服务，请手动检查："
        echo "   sudo systemctl status docker"
        exit 1
    fi
fi

# 设置 Docker 命令前缀（如果需要 sudo）
if [ -z "$DOCKER_CMD" ]; then
    DOCKER_CMD="docker"
fi

# 检查 Docker Compose 是否安装
COMPOSE_AVAILABLE=false
# 优先检查 Docker Compose V2 (docker compose)
if $DOCKER_CMD compose version &> /dev/null 2>&1; then
    echo "✅ 检测到 Docker Compose V2 (docker compose)"
    DOCKER_COMPOSE_CMD="$DOCKER_CMD compose"
    COMPOSE_AVAILABLE=true
elif command -v docker-compose &> /dev/null; then
    echo "✅ 检测到 Docker Compose V1 (docker-compose)"
    if [ "$DOCKER_CMD" = "sudo docker" ]; then
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    else
        DOCKER_COMPOSE_CMD="docker-compose"
    fi
    COMPOSE_AVAILABLE=true
else
    echo "❌ Docker Compose 未安装"
    echo ""
    echo "请手动安装 Docker Compose："
    echo ""
    echo "方式1 - 安装 Docker Compose V1："
    echo "  sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
    echo "  sudo chmod +x /usr/local/bin/docker-compose"
    echo ""
    echo "方式2 - 使用 Docker Compose V2（推荐，Docker 20.10+ 已包含）："
    echo "  通常 Docker Compose V2 已包含在 Docker 中，请检查: $DOCKER_CMD compose version"
    echo ""
    exit 1
fi

echo "✅ 环境检查完成"
echo "   使用命令: $DOCKER_CMD, $DOCKER_COMPOSE_CMD"
echo ""

echo "✅ 环境检查完成"
echo ""

# 停止并删除旧容器（如果存在）
echo "🧹 清理旧容器..."
$DOCKER_COMPOSE_CMD down 2>/dev/null || true
echo ""

# 构建并启动所有服务
echo "🔨 构建 Docker 镜像..."
$DOCKER_COMPOSE_CMD build

echo ""
echo "🚀 启动所有服务..."
$DOCKER_COMPOSE_CMD up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态检查："
$DOCKER_COMPOSE_CMD ps

# 等待服务完全启动
echo ""
echo "⏳ 等待所有服务完全启动（最多 30 秒）..."
for i in {1..30}; do
    if $DOCKER_COMPOSE_CMD ps 2>/dev/null | grep -q "Up"; then
        echo "✅ 服务已启动"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# 检查关键服务
echo ""
echo "🔍 检查关键服务..."
if $DOCKER_CMD ps | grep -q "contact_mysql"; then
    echo "✅ MySQL 运行中"
else
    echo "⚠️  MySQL 可能未正常启动，请检查日志: $DOCKER_COMPOSE_CMD logs mysql"
fi

if $DOCKER_CMD ps | grep -q "contact_backend"; then
    echo "✅ 后端服务运行中"
else
    echo "⚠️  后端服务可能未正常启动，请检查日志: $DOCKER_COMPOSE_CMD logs backend"
fi

if $DOCKER_CMD ps | grep -q "contact_nginx"; then
    echo "✅ Nginx 运行中"
else
    echo "⚠️  Nginx 可能未正常启动，请检查日志: $DOCKER_COMPOSE_CMD logs nginx"
fi

echo ""
echo "=========================================="
echo "✅ 项目启动完成！"
echo "=========================================="
echo ""
echo "🌐 访问地址："
echo "   - 前端（通过 Nginx）: http://localhost"
echo "   - 后端 API: http://localhost:3000"
echo "   - MySQL: localhost:3306"
echo ""
echo "📋 常用命令："
if [ "$DOCKER_CMD" = "sudo docker" ]; then
    echo "   - 查看所有日志: sudo docker-compose logs -f"
    echo "   - 查看后端日志: sudo docker-compose logs -f backend"
    echo "   - 查看 MySQL 日志: sudo docker-compose logs -f mysql"
    echo "   - 查看 Nginx 日志: sudo docker-compose logs -f nginx"
    echo "   - 停止服务: sudo docker-compose down"
    echo "   - 重启服务: sudo docker-compose restart"
    echo "   - 查看状态: sudo docker-compose ps"
else
    echo "   - 查看所有日志: docker-compose logs -f"
    echo "   - 查看后端日志: docker-compose logs -f backend"
    echo "   - 查看 MySQL 日志: docker-compose logs -f mysql"
    echo "   - 查看 Nginx 日志: docker-compose logs -f nginx"
    echo "   - 停止服务: docker-compose down"
    echo "   - 重启服务: docker-compose restart"
    echo "   - 查看状态: docker-compose ps"
fi
echo ""
echo "💡 提示："
echo "   - 如果前端无法访问后端，请等待几秒钟让所有服务完全启动"
echo "   - 首次启动可能需要一些时间来初始化数据库"
echo "   - 如果遇到问题，请查看日志: docker-compose logs"
echo ""

