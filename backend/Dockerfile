FROM golang:1.21-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# Copy all source first so go mod tidy can see all imports
COPY . .

# Resolve dependencies and update go.sum
RUN go mod tidy

# Build
RUN go build -o /bin/server ./cmd/server

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

COPY --from=builder /bin/server /app/server

EXPOSE 8080

CMD ["/app/server"]
