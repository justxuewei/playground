CC     = gcc
CFLAGS = -Wall -g
LIBS   = -lpthread

SRCS = $(wildcard *.c)
OBJS = $(SRCS:.c=.out)

.PHONY: all clean

all:
	@$(foreach src,$(SRCS),echo "compiling $(src)" && \
		$(CC) $(CFLAGS) $(src) -o $(src:.c=.out) $(LIBS) && \
		chmod +x $(src:.c=.out);)

clean:
	@rm -f $(OBJS)
