FROM alpine:3.20

# loongcode 二进制是 musl 静态编译，Alpine 基础镜像体积小、原生兼容。
# 镜像只含 x64（amd64）架构。ripgrep 是 server 做代码搜索的运行时依赖。
RUN apk add --no-cache libgcc libstdc++ ripgrep ca-certificates

COPY dist/loongcode-linux-x64-baseline-musl/bin/loongcode /usr/local/bin/loongcode
RUN chmod +x /usr/local/bin/loongcode && loongcode --version

ENTRYPOINT ["loongcode"]
