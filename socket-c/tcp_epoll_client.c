#include <sys/epoll.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>

#define MAX_EVENTS 10
#define BUFFER_SIZE 1024

int main(int argc, char **argv)
{
	if (argc != 3) {
		printf("Usage: %s <IP> <PORT>\n", argv[0]);
		return -EINVAL;
	}

	const char *ip = argv[1];
	int port = atoi(argv[2]);

	int sockfd, epfd, flag, nfds, i, n, err;
	struct sockaddr_in addr;
	socklen_t addr_len, flag_len;
	struct epoll_event ev, events[MAX_EVENTS];
	char buffer[BUFFER_SIZE];

	epfd = epoll_create1(0);
	if (epfd < 0) {
		perror("epoll_create1");
		return epfd;
	}

	sockfd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, IPPROTO_IP);
	if (sockfd < 0) {
		err = sockfd;
		goto out_ep;
	}

	addr_len = sizeof(addr);
	err = getsockname(sockfd, (struct sockaddr *)&addr, &addr_len);
	if (err < 0) {
		perror("getsockname");
		goto out;
	}

	flag = 1;
	err = setsockopt(sockfd, SOL_TCP, TCP_NODELAY, &flag, sizeof(flag));
	if (err < 0) {
		perror("setsockopt TCP_NODELAY");
		goto out;
	}

	flag = 1;
	err = setsockopt(sockfd, SOL_SOCKET, SO_KEEPALIVE, &flag, sizeof(flag));
	if (err < 0) {
		perror("setsockopt SO_KEEPALIVE");
		goto out;
	}

	ev.events = EPOLLRDHUP | EPOLLET;
	ev.data.fd = sockfd;
	err = epoll_ctl(epfd, EPOLL_CTL_ADD, sockfd, &ev);
	if (err < 0) {
		perror("epoll_ctl add sockfd");
		goto out;
	}

	memset(&addr, 0, sizeof(addr));
	addr.sin_family = AF_INET;
	addr.sin_port = htons(port);

	err = inet_pton(AF_INET, ip, &addr.sin_addr);
	if (err <= 0) {
		perror("inet_pton");
		goto out;
	}

	err = connect(sockfd, (struct sockaddr *)&addr, sizeof(addr));
	if (err < 0) {
		if (errno != EINPROGRESS) {
			perror("connect");
			goto out;
		}

		ev.events = EPOLLOUT | EPOLLRDHUP | EPOLLET;
		err = epoll_ctl(epfd, EPOLL_CTL_MOD, sockfd, &ev);

		while (1) {
			nfds = epoll_wait(epfd, events, MAX_EVENTS, -1);
			if (nfds < 0) {
				perror("epoll_wait sockfd conn");
				err = nfds;
				goto out;
			}
			for (int i = 0; i < nfds; ++i) {
				if (events[i].events & EPOLLERR ||
				    events[i].events & EPOLLHUP ||
				    !(events[i].events &
				      (EPOLLOUT | EPOLLRDHUP))) {
					perror("epoll error");
					err = -1;
					goto out;
				}
				if (events[i].events & EPOLLOUT) {
					flag = 0;
					flag_len = sizeof(flag);
					err = getsockopt(sockfd, SOL_SOCKET,
							 SO_ERROR, &flag,
							 &flag_len);
					if (err < 0) {
						perror("getsockopt SO_ERROR");
						goto out;
					}
					if (flag < 0) {
						perror("connect error");
						err = flag;
						goto out;
					}

					ev.events = EPOLLRDHUP | EPOLLET;
					err = epoll_ctl(epfd, EPOLL_CTL_MOD,
							sockfd, &ev);
					if (err < 0) {
						perror("epoll_ctl mod sockfd conn");
						goto out;
					}
					goto out_loop1;
				}
				if (events[i].events & EPOLLRDHUP) {
					printf("Remote peer has closed the connection or shut down for reading.\n");
					err = -1;
					goto out;
				}
			}
		}
	}

out_loop1:
	ev.events = EPOLLIN | EPOLLRDHUP | EPOLLET;
	err = epoll_ctl(epfd, EPOLL_CTL_MOD, sockfd, &ev);
	if (err < 0) {
		perror("epoll_ctl add sockfd");
		goto out;
	}

	n = sendto(sockfd, "hello", 5, 0, NULL, 0);
	if (n < 5) {
		perror("sendto");
		err = n;
		goto out;
	}
	printf("sent %d bytes\n", n);

	while (1) {
		nfds = epoll_wait(epfd, events, MAX_EVENTS, -1);
		if (nfds < 0) {
			perror("epoll_wait sockfd conn");
			err = nfds;
			goto out;
		}
		for (i = 0; i < nfds; ++i) {
			if (events[i].events & EPOLLERR ||
			    events[i].events & EPOLLHUP ||
			    !(events[i].events & (EPOLLIN | EPOLLRDHUP))) {
				perror("epoll error");
				err = -1;
				goto out;
			}
			if (events[i].events & EPOLLIN) {
				n = recv(sockfd, buffer, BUFFER_SIZE, 0);
				if (n < 0) {
					perror("recv");
					err = n;
					goto out;
				}
				if (n >= BUFFER_SIZE) {
					printf("recv buffer overflow\n");
					err = -EOVERFLOW;
					goto out;
				}
				buffer[n] = '\0';
				printf("recv %d bytes: %s\n", n, buffer);
				goto out;
			}
			if (events[i].events & EPOLLRDHUP) {
				printf("Remote peer has closed the connection or shut down for reading.\n");
				err = -1;
				goto out;
			}
		}
	}

out:
	close(sockfd);
out_ep:
	close(epfd);
	return err;
}