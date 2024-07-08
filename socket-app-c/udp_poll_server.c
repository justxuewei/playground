#include <sys/socket.h>
#include <linux/vm_sockets.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <poll.h>

#define BUFSIZE 1024
#define MAX_CLIENTS 10

int main(int argc, char **argv)
{
	if (argc != 3) {
		printf("Usage: %s {sendto_ip} {sendto_port}\n", argv[0]);
		return 1;
	}

	int sockfd, i, n, nready, err;
	size_t addr_len;
	struct pollfd fds[MAX_CLIENTS];
	uint32_t server_ip, server_port;
	struct sockaddr_in server_addr, client_addr;
	char buf[BUFSIZE], *client_ip;

	// convert ip and port string to int
	inet_pton(AF_INET, argv[1], &server_ip);
	server_port = atoi(argv[2]);

	if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
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
		goto out;
	}

	printf("bound at %s:%s\n", argv[1], argv[2]);

	fds[0].fd = sockfd;
	fds[0].events = POLLIN;
	for (i = 1; i < MAX_CLIENTS; i++) {
		fds[i].fd = -1;
	}

    // vsocket->poll()
    // csocket->poll()/recvfrom()
	nready = poll(fds, MAX_CLIENTS, -1);
	if (nready < 0) {
		perror("poll error");
		err = -1;
		goto out;
	}

	if ((fds[0].revents & POLLIN) == 0) {
		printf("no inbound data\n");
		goto out;
	}

	memset(&client_addr, 0, sizeof(struct sockaddr_in));
	addr_len = sizeof(struct sockaddr_in);

	memset(buf, 0, BUFSIZE);
	printf("waiting for a message to arrive...\n");
	n = recvfrom(sockfd, buf, BUFSIZE, MSG_WAITALL,
		     (struct sockaddr *)&client_addr, (socklen_t *)&addr_len);
	if (n >= BUFSIZE) {
		perror("buffer overflow");
		err = -1;
		goto out;
	} else if (n < 0) {
		perror("recvfrom failed");
		err = n;
		goto out;
	}

	buf[n] = '\0';
	client_ip = inet_ntoa(client_addr.sin_addr);
	printf("received %d bytes from \"%s:%d\":\n%s\n", n, client_ip,
	       client_addr.sin_port, buf);

out:
	close(sockfd);
	return err;
}