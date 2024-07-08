#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#define BUFSIZE 1024
#define MAX_CLIENTS 10

int main(int argc, char **argv)
{
	if (argc != 3) {
		printf("Usage: %s {ip} {port}\n", argv[0]);
		return 1;
	}

	int sockfd, newsockfd, n, err;
	char buf[BUFSIZE], *client_ip;
	uint32_t server_ip, server_port;
	struct sockaddr_in server_addr, client_addr;
	socklen_t addr_len;

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

	addr_len = sizeof(struct sockaddr_in);
	if ((newsockfd = accept(sockfd, (struct sockaddr *)&client_addr,
				&addr_len)) < 0) {
		perror("accept failed");
		return newsockfd;
	}

	memset(buf, 0, BUFSIZE);
	n = read(newsockfd, buf, BUFSIZE - 1);
	if (n < 0) {
		perror("read failed");
		return n;
	}

	buf[n] = '\0';
	client_ip = inet_ntoa(client_addr.sin_addr);
	printf("received %d bytes from \"%s:%d\":\n%s\n", n, client_ip,
	       ntohs(client_addr.sin_port), buf);

	close(newsockfd);
	close(sockfd);

	return 0;
}
