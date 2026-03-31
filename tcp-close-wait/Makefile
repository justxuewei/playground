CC     = gcc
CFLAGS = -Wall -g
LIBS   = -lpthread

SRCS = $(wildcard *.c)
OBJS = $(SRCS:.c=.out)

.PHONY: all clean go-server go-client

all: $(OBJS) go-server go-client

$(OBJS): %.out: %.c
	$(CC) $(CFLAGS) $< -o $@ $(LIBS)
	chmod +x $@

go-server:
	cd server && go build -o tcp_close_wait_go_server .

go-client:
	cd client && go build -o tcp_close_wait_go_client .

clean:
	@rm -f $(OBJS)
	@rm -f server/tcp_close_wait_go_server client/tcp_close_wait_go_client
