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
	if (argc != 5) {
		printf("Usage: %s {bind_ip} {bind_port} {ip} {port}\n", argv[0]);
		return 1;
	}

	int sockfd, n;
	uint32_t server_ip, server_port;
	struct sockaddr_in bind_addr, server_addr;
	char buf[BUFSIZE];

	// Convert IP and port strings to integers
    uint32_t bind_ip;
    uint16_t bind_port;
    inet_pton(AF_INET, argv[1], &bind_ip);
    bind_port = atoi(argv[2]);
    inet_pton(AF_INET, argv[1], &server_ip);
    server_port = atoi(argv[4]);

	if ((sockfd = socket(AF_INET, SOCK_STREAM, 0)) < 0) {
		perror("socket failed");
		return sockfd;
	}

    // Bind socket to specified IP and port
    memset(&bind_addr, 0, sizeof(bind_addr));
    bind_addr.sin_family = AF_INET;
    bind_addr.sin_port = htons(bind_port);
    bind_addr.sin_addr.s_addr = bind_ip;

    if (bind(sockfd, (struct sockaddr *)&bind_addr, sizeof(bind_addr)) < 0) {
        perror("bind failed");
        close(sockfd);
        return 1;
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
	printf("sent %d bytes to \"%s:%s\" from \"%s:%s\":\n%s\n", n, argv[3], argv[4], argv[1], argv[2], buf);

	close(sockfd);
	return 0;
}
