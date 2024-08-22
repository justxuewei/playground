#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <poll.h>

#define BUFSIZE 1024
#define MAX_CLIENTS 10

int main(int argc, char **argv)
{
	if (argc != 3) {
		printf("Usage: %s {ip} {port}\n", argv[0]);
		return 1;
	}

	int sockfd, newsockfd, i, round, n, nready, err;
	char buf[BUFSIZE];
	uint32_t server_ip, server_port;
	struct sockaddr_in server_addr, client_addr;
	socklen_t addr_len;
	struct pollfd fds[MAX_CLIENTS];

	// Convert IP and port string to int
	inet_pton(AF_INET, argv[1], &server_ip);
	server_port = atoi(argv[2]);

	if ((sockfd = socket(AF_INET, SOCK_STREAM, 0)) < 0) {
		perror("socket failed");
		return sockfd;
	}

	memset(&server_addr, 0, sizeof(struct sockaddr_in));
	server_addr.sin_family = AF_INET;
	server_addr.sin_port = htons(server_port);
	server_addr.sin_addr.s_addr = server_ip;

	if ((err = bind(sockfd, (struct sockaddr *)&server_addr,
			sizeof(struct sockaddr_in))) < 0) {
		perror("bind failed");
		return err;
	}

	printf("bound at %s:%s\n", argv[1], argv[2]);

	if ((err = listen(sockfd, MAX_CLIENTS)) < 0) {
		perror("listen failed");
		return err;
	}

	printf("waiting for a connection to arrive...\n");

	fds[0].fd = sockfd;
	fds[0].events = POLLIN;
	for (i = 1; i < MAX_CLIENTS; i++) {
		fds[i].fd = -1;
	}

	for (round = 0; round < 2; round++) {
		nready = poll(fds, MAX_CLIENTS, -1);
		if (nready < 0) {
			perror("poll error");
			return -1;
		}

		if (fds[0].revents & POLLIN) {
			addr_len = sizeof(struct sockaddr_in);
			if ((newsockfd = accept(sockfd,
						(struct sockaddr *)&client_addr,
						&addr_len)) < 0) {
				perror("accept failed");
				continue;
			}

			printf("new connection from %s:%d\n",
			       inet_ntoa(client_addr.sin_addr),
			       ntohs(client_addr.sin_port));

			for (i = 1; i < MAX_CLIENTS; i++) {
				if (fds[i].fd < 0) {
					fds[i].fd = newsockfd;
					fds[i].events = POLLIN;
					break;
				}
			}

			if (i == MAX_CLIENTS) {
				printf("too many clients\n");
				close(newsockfd);
			}
		}

		for (i = 1; i < MAX_CLIENTS; i++) {
			if (fds[i].fd < 0)
				continue;

			if (fds[i].revents & (POLLIN | POLLERR)) {
				memset(buf, 0, BUFSIZE);
				n = read(fds[i].fd, buf, BUFSIZE - 1);
				if (n <= 0) {
					if (n < 0)
						perror("read error");
					else
						printf("client at %d closed connection\n",
						       fds[i].fd);

					close(fds[i].fd);
					fds[i].fd = -1;
				} else {
					buf[n] = '\0';
					printf("received %d bytes from \"%s:%d\":\n%s\n",
					       n,
					       inet_ntoa(client_addr.sin_addr),
					       ntohs(client_addr.sin_port),
					       buf);
				}
			}
		}
	}

	for (i = 0; i < MAX_CLIENTS; i++) {
		if (fds[i].fd < 0)
			continue;
		close(fds[i].fd);
	}

	return err;
}
