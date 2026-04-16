FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./
# go.sum is generated automatically; copy if present
COPY go.su[m] ./
RUN go mod tidy && go mod download

COPY . .
RUN go build -o /bin/server ./cmd/server

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/server /app/server

EXPOSE 8080

CMD ["/app/server"]
