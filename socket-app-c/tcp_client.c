#include <sys/socket.h>
#include <linux/vm_sockets.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define BUFSIZE 1024

int main(int argc, char **argv)
{
	if (argc != 3) {
		printf("Usage: %s {ip} {port}\n", argv[0]);
		return 1;
	}

	int sockfd, n;
	uint32_t server_ip, server_port;
	struct sockaddr_in server_addr;
	char buf[BUFSIZE];

	// convert ip and port string to int
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

	if (connect(sockfd, (struct sockaddr *)&server_addr,
		    sizeof(struct sockaddr_in)) < 0) {
		perror("connect failed");
		return -1;
	}

	memset(buf, 0, BUFSIZE);
	strcpy(buf, "hello from client!");
	n = send(sockfd, buf, strlen(buf), 0);
	if (n < 0) {
		perror("send failed");
		return n;
	}
	printf("sent %d bytes to \"%s:%s\":\n%s\n", n, argv[1], argv[2], buf);

	close(sockfd);
	return 0;
}
