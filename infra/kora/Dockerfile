# Kora signer node — Solana gasless fee relayer
# Agents pay USDC for gas instead of SOL
# https://github.com/solana-foundation/kora

FROM rust:1.88-bookworm AS builder

# `time@0.3.47` (transitive dep of kora-cli) requires rustc >= 1.88.
RUN cargo install kora-cli --locked

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/cargo/bin/kora /usr/local/bin/kora

WORKDIR /app
COPY kora.toml signers.toml entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
