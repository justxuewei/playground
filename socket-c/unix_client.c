#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define BUFSIZE 1024

socklen_t init_sockaddr_un(struct sockaddr_un *sun, char *path,
			   int use_abs_path)
{
	socklen_t len = sizeof(*sun);
	size_t copied_len = 0;

	memset(sun, 0, sizeof(*sun));

	sun->sun_family = AF_UNIX;

	if (use_abs_path) {
		copied_len = strnlen(path, sizeof(sun->sun_path) - 2);
		strncpy(sun->sun_path + 1, path, copied_len);
		len -= (108 - copied_len - 1);
	} else {
		copied_len = strnlen(path, sizeof(sun->sun_path) - 1);
		strncpy(sun->sun_path, path, copied_len);
		len -= (108 - copied_len);
	}

	return len;
}

int main(int argc, char **argv)
{
	char *path = NULL;
	int use_abs_path, sockfd, n, err = 0;
	struct sockaddr_un server_addr;
	socklen_t server_addr_len;
	char buf[BUFSIZE];

	if (argc == 2) {
		path = argv[1];
		use_abs_path = 0;
	} else if (argc == 3) {
		if (strcmp(argv[1], "-a")) {
			err = -1;
			goto printusage;
		}
		use_abs_path = 1;
		path = argv[2];
	} else {
		err = -1;
		goto printusage;
	}

	if ((sockfd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0) {
		perror("socket failed");
		return sockfd;
	}

	server_addr_len = init_sockaddr_un(&server_addr, path, use_abs_path);

	err = connect(sockfd, (struct sockaddr *)&server_addr, server_addr_len);
	if (err < 0) {
		perror("connect failed");
		goto closeall;
	}

	memset(buf, 0, BUFSIZE);
	strcpy(buf, "hello from client!");
	n = send(sockfd, buf, strlen(buf), 0);
	if (n < 0) {
		perror("send failed");
		err = n;
		goto closeall;
	}
	printf("Sent %d bytes to server:\n%s\n", n, buf);

	memset(buf, 0, BUFSIZE);
	n = recv(sockfd, buf, BUFSIZE, 0);
	if (n < 0) {
		perror("recv failed");
		err = n;
		goto closeall;
	}
	printf("Received %d bytes from server:\n%s\n", n, buf);

closeall:
	close(sockfd);
	return err;

printusage:
	printf("Usage: %s [-a] {socket_path}\n", argv[0]);
	return err;
}
