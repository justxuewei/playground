#include <sys/socket.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/un.h>
#include <time.h>

#define BUFSIZE 1024
#define BACKLOG 5

void now_time(char *buffer, size_t bufsize)
{
	time_t rawtime;
	struct tm *timeinfo;

	time(&rawtime);
	timeinfo = localtime(&rawtime);

	strftime(buffer, bufsize, "%H:%M:%S", timeinfo);
}

// vsock_server_host {UDS_PATH} {PORT}
int main(int argc, char **argv)
{
	if (argc != 3) {
		printf("Usage: %s {UDS_PATH} {PORT}\n", argv[0]);
		return 1;
	}

	int sockfd, connfd, n;
	struct sockaddr_un server_addr, client_addr;
	socklen_t client_addr_len;
	char buffer[BUFSIZE], socket_path[BUFSIZE], now[64];

	snprintf(socket_path, sizeof(socket_path), "%s_%s", argv[1], argv[2]);

	if ((sockfd = socket(AF_UNIX, SOCK_STREAM, 0)) == -1) {
		perror("Error on creating socket");
		exit(EXIT_FAILURE);
	}

	memset(&server_addr, 0, sizeof(struct sockaddr_un));
	server_addr.sun_family = AF_UNIX;
	strncpy(server_addr.sun_path, socket_path,
		sizeof(server_addr.sun_path) - 1);

	unlink(socket_path);

	if (bind(sockfd, (struct sockaddr *)&server_addr,
		 sizeof(struct sockaddr_un)) == -1) {
		perror("Error on binding");
		close(sockfd);
		exit(EXIT_FAILURE);
	}

	if (listen(sockfd, BACKLOG) == -1) {
		perror("Error on listening");
		close(sockfd);
		exit(EXIT_FAILURE);
	}

	printf("Listening on %s\n", socket_path);

	while (1) {
		now_time(now, sizeof(now));
		printf("[%s] Waiting for connection from peer...\n", now);
		if ((connfd = accept(sockfd, (struct sockaddr *)&client_addr,
				     &client_addr_len)) == -1) {
			perror("Error on accepting");
			continue;
		}
		bzero(buffer, BUFSIZE);
		printf("Waiting for peer to write...\n");
		n = read(connfd, buffer, sizeof(buffer));
		if (n > 0) {
			printf("Received %d bytes: %s\n", n, buffer);
		} else {
			printf("Failed to read from peer, n: %d\n", n);
			break;
		}

		bzero(buffer, BUFSIZE);
		strncpy(buffer, "hello from host", sizeof(buffer) - 1);
		n = write(connfd, buffer, strlen(buffer));
		if (n > 0) {
			printf("Sent %d bytes\n", n);
		} else {
			printf("Failed to send to peer, n: %d\n", n);
			break;
		}
	}

	close(sockfd);
	unlink(socket_path);

	return 0;
}
