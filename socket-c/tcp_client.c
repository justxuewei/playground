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
	int opt;
	int do_bind = 0;
	char *bind_ip_str = NULL;
	char *bind_port_str = NULL;
	char *server_ip_str = NULL;
	char *server_port_str = NULL;

	while ((opt = getopt(argc, argv, "b:")) != -1) {
		switch (opt) {
		case 'b':
			do_bind = 1;
			bind_ip_str = optarg;
			if (optind < argc && argv[optind][0] != '-') {
				bind_port_str = argv[optind++];
			}
			break;
		default:
			fprintf(stderr,
				"Usage: %s -b {bind_ip} {bind_port} {ip} {port}\n",
				argv[0]);
			return 1;
		}
	}

	if (optind + 2 != argc) {
		fprintf(stderr,
			"Usage: %s -b {bind_ip} {bind_port} {ip} {port}\n",
			argv[0]);
		return 1;
	}

	server_ip_str = argv[optind++];
	server_port_str = argv[optind];

	int sockfd, n;
	uint32_t server_ip, server_port;
	struct sockaddr_in bind_addr, server_addr;
	char buf[BUFSIZE];

	// Convert IP and port strings to integers
	uint32_t bind_ip;
	uint16_t bind_port;
	if (do_bind) {
		inet_pton(AF_INET, bind_ip_str, &bind_ip);
		bind_port = atoi(bind_port_str);
	}
	inet_pton(AF_INET, server_ip_str, &server_ip);
	server_port = atoi(server_port_str);

	if ((sockfd = socket(AF_INET, SOCK_STREAM, 0)) < 0) {
		perror("socket failed");
		return sockfd;
	}

	if (do_bind) {
		// Bind socket to specified IP and port
		memset(&bind_addr, 0, sizeof(bind_addr));
		bind_addr.sin_family = AF_INET;
		bind_addr.sin_port = htons(bind_port);
		bind_addr.sin_addr.s_addr = bind_ip;

		if (bind(sockfd, (struct sockaddr *)&bind_addr,
			 sizeof(bind_addr)) < 0) {
			perror("bind failed");
			close(sockfd);
			return 1;
		}
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
	if (do_bind) {
		printf("sent %d bytes to \"%s:%s\" from \"%s:%s\":\n%s\n", n,
		       server_ip_str, server_port_str, bind_ip_str,
		       bind_port_str, buf);
	} else {
		printf("sent %d bytes to \"%s:%s\" without binding:\n%s\n", n,
		       server_ip_str, server_port_str, buf);
	}

	close(sockfd);
	return 0;
}
