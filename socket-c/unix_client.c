#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define BUFSIZE 1024

int main(int argc, char **argv)
{
	char path[108];
	int use_abs_path, sockfd, n;
	struct sockaddr_un server_addr;
	char buf[BUFSIZE];

	if (argc == 2) {
		strcpy(path, argv[1]);
		use_abs_path = 0;
	} else if (argc == 3) {
		if (strcmp(argv[1], "-a"))
			goto out;
		use_abs_path = 1;
		strcpy(path, argv[2]);
	} else {
		goto out;
	}

	if ((sockfd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0) {
		perror("socket failed");
		return sockfd;
	}

	memset(&server_addr, 0, sizeof(struct sockaddr_un));
	server_addr.sun_family = AF_UNIX;
	if (use_abs_path) {
		strncpy(server_addr.sun_path + 1, path,
			sizeof(server_addr.sun_path) - 2);
	} else {
		strncpy(server_addr.sun_path, path,
			sizeof(server_addr.sun_path) - 1);
	}

	if (connect(sockfd, (struct sockaddr *)&server_addr,
		    sizeof(struct sockaddr_un)) < 0) {
		perror("connect failed");
		close(sockfd);
		return -1;
	}

	memset(buf, 0, BUFSIZE);
	strcpy(buf, "hello from client!");
	n = send(sockfd, buf, strlen(buf), 0);
	if (n < 0) {
		perror("send failed");
		close(sockfd);
		return n;
	}
	printf("Sent %d bytes to server:\n%s\n", n, buf);

	memset(buf, 0, BUFSIZE);
	n = recv(sockfd, buf, BUFSIZE, 0);
	if (n < 0) {
		perror("recv failed");
		close(sockfd);
		return n;
	}
	printf("Received %d bytes from server:\n%s\n", n, buf);

	close(sockfd);
	return 0;

out:
	printf("Usage: %s [-a] {socket_path}\n", argv[0]);
	return -1;
}
