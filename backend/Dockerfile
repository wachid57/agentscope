FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install git (needed by go mod tidy to fetch deps)
RUN apk add --no-cache git

# Copy only go.mod first — go.sum will be generated inside the container
COPY go.mod ./

# Generate go.sum and download all dependencies
RUN go mod tidy

# Copy the rest of the source
COPY . .

# Build (go.sum now exists so this will succeed)
RUN go build -o /bin/server ./cmd/server

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

COPY --from=builder /bin/server /app/server

EXPOSE 8080

CMD ["/app/server"]
